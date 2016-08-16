const co = require('co');
const _ = require('lodash');
const columnify = require('columnify');
const Cluster = require('../../../lib/Kubernetes/Cluster');
const CaCluster = require('../../../lib/cAdvisor/Cluster');
const Node = require('../../../lib/Kubernetes/Node');

function resources() {
  return co(function*() {
    const nodes = yield new Cluster().getAllNodes({
      // exclude master node
      externalIpOnly: true
    })
      .then(nodes => Promise.all(nodes.map(n => n.getJson())));

    // Flatten down to a  list of containers
    const containers = yield flatMapAsync(nodes, node => co(function*() {
      const podsInNode = yield new Node(node.metadata.name).getAllPods();
      const podsJson = yield podsInNode.map(p => p.getJson());

      return podsJson.map(pod => pod.spec.containers.map(c => ({
        name: c.name,
        pod: pod.metadata.name,
        namespace: pod.metadata.namespace,
        node: node.metadata.name,
        requests: c.resources.requests ? parseResources(c.resources.requests) : {},
        limits: c.resources.limits ? parseResources(c.resources.limits) : {}
      })));
    }));

    const caCluster = yield CaCluster.fromKubernetesCluster();
    const containerStats = yield caCluster.getAllContainerStats();
    const statsByNode = _.mapValues(_.groupBy(containerStats, 'node'), stats => ({
      cpu: {
        current: _.sumBy(stats, 'cpu.current')
      },
      memory: {
        hot: _.sumBy(stats, 'memory.hot'),
        total: _.sumBy(stats, 'memory.total')
      }
    }));

    const nodeResources = chunkBy(containers, 'node')
      .map(containersInNode => ({
        name: containersInNode[0].node,
        requests: {
          cpu: _.sumBy(containersInNode, c => c.requests.cpu),
          memory: _.sumBy(containersInNode, c => c.requests.memory)
        },
        limits: {
          cpu: _.sumBy(containersInNode, c => c.limits.cpu),
          memory: _.sumBy(containersInNode, c => c.limits.memory)
        },
        capacity: parseResources(
          // Find the matching node JSON
          nodes.find(n => n.metadata.name === containersInNode[0].node).status.capacity
        ),
        stats: statsByNode[containersInNode[0].node]
      }));
    const totalResources = {
      name: 'Total',
      capacity: {
        cpu: _.sumBy(nodeResources, 'capacity.cpu'),
        memory: _.sumBy(nodeResources, 'capacity.memory'),
        pods: _.sumBy(nodeResources, 'capacity.pods')
      },
      requests: {
        cpu: _.sumBy(nodeResources, 'requests.cpu'),
        memory: _.sumBy(nodeResources, 'requests.memory')
      },
      limits: {
        cpu: _.sumBy(nodeResources, 'limits.cpu'),
        memory: _.sumBy(nodeResources, 'limits.memory')
      },
      stats: {
        cpu: {
          current: _.sumBy(containerStats, 'cpu.current')
        },
        memory: {
          hot: _.sumBy(containerStats, 'memory.hot'),
          total: _.sumBy(containerStats, 'memory.total')
        }
      }
    };

    const nodeCpuCols = nodeResources.concat(totalResources)
      .map(node => ({
        'Node': node.name + '    ',
        'CPU Req': printCpu(node.requests.cpu) + ` ${printPerc(node.requests.cpu, node.capacity.cpu)}`,
        'CPU Limit': printCpu(node.limits.cpu) + ` ${printPerc(node.limits.cpu, node.capacity.cpu)}`,
        'CPU Used': printCpu(node.stats.cpu.current) + ` ${printPerc(node.stats.cpu.current, node.capacity.cpu)}`,
        'CPU Cap': printCpu(node.capacity.cpu),
        'CPU Avail': printCpu(node.capacity.cpu - node.requests.cpu) + ` ${printPerc(node.capacity.cpu - node.requests.cpu, node.capacity.cpu)}`
      }));

    const nodeMemCols = nodeResources.concat(totalResources)
      .map(node => ({
        'Node': node.name + '    ',
        'Mem Req': printMem(node.requests.memory) + ` ${printPerc(node.requests.memory, node.capacity.memory)}`,
        'Mem Limit': printMem(node.limits.memory) + ` ${printPerc(node.limits.memory, node.capacity.memory)}`,
        'Mem Used Hot': printMem(node.stats.memory.hot) + ` ${printPerc(node.stats.memory.hot, node.capacity.memory)}`,
        'Mem Used Total': printMem(node.stats.memory.total) + ` ${printPerc(node.stats.memory.total, node.capacity.memory)}`,
        'Mem Cap': printMem(node.capacity.memory),
        'Mem Avail': printMem(node.capacity.memory - node.requests.memory) + ` ${printPerc(node.capacity.memory - node.requests.memory, node.capacity.memory)}`
      }));

    const statsByContainer = _.mapValues(_.groupBy(containerStats, c => [c.container, c.namespace].join('/')), stats => ({
      cpu: {
        current: _.sumBy(stats, 'cpu.current')
      },
      memory: {
        hot: _.sumBy(stats, 'memory.hot'),
        total: _.sumBy(stats, 'memory.total')
      }
    }));
    const containerResources = chunkBy(containers, c => c.name + c.namespace)
      .map(conts => ({
        name: conts[0].name,
        namespace: conts[0].namespace,
        count: conts.length,
        requests: {
          cpu: _.sumBy(conts, 'requests.cpu'),
          memory: _.sumBy(conts, 'requests.memory')
        },
        limits: {
          cpu: _.sumBy(conts, 'limits.cpu'),
          memory: _.sumBy(conts, 'limits.memory')
        },
        stats: statsByContainer[[conts[0].name, conts[0].namespace].join('/')],
        pods: conts.length
      }));

    const containerCols = _.sortBy(containerResources, c => c.namespace + c.name)
      .map(c => ({
        'Container': c.name,
        'NS': c.namespace,
        'CPU Req': printCpu(c.requests.cpu) + ` ${printPerc(c.requests.cpu, totalResources.capacity.cpu)}`,
        'CPU Limit': printCpu(c.limits.cpu) + ` ${printPerc(c.limits.cpu, totalResources.capacity.cpu)}`,
        'CPU Used': printCpu(c.stats.cpu.current) + ` ${printPerc(c.stats.cpu.current, totalResources.capacity.cpu)}`,
        'Mem Req': printMem(c.requests.memory) + ` ${printPerc(c.requests.memory, totalResources.capacity.memory)}`,
        'Mem Limit': printMem(c.limits.memory) + ` ${printPerc(c.limits.memory, totalResources.capacity.memory)}`,
        'Mem Used Hot': printMem(c.stats.memory.hot) + ` ${printPerc(c.stats.memory.hot, totalResources.capacity.memory)}`,
        'Count': c.count
      }));

    const colOpts = { columnSplitter: '   ' };
    const output = `
${columnify(nodeCpuCols, colOpts)}

${columnify(nodeMemCols, colOpts)}

${columnify(containerCols, extend(colOpts, {
  maxWidth: 20,
  truncate: true
}))}
  `.trim();

    console.log(output);
  });
}
module.exports = resources;

function printCpu(cores) {
  return _.isNumber(cores) ? cores.toFixed(2) : '-';
}
function printMem(bytes) {
  return _.isNumber(bytes) ? `${(bytes / Math.pow(1024, 3)).toFixed(2)} Gi` : '-';
}
function printPerc(val, total) {
  return _.isNumber(val) ? `${(val * 100 / total).toFixed(0)}%` : '';
}


function extend(obj, extObj) {
  return Object.assign({}, obj, extObj);
}

function parseResources(resources) {
  var parsed = {};

  if ('cpu' in resources) {
    parsed.cpu = parseCpus(resources.cpu);
  }
  if ('memory' in resources) {
    parsed.memory = parseMemory(resources.memory);
  }
  if ('pods' in resources) {
    parsed.pods = parsePods(resources.pods);
  }

  return parsed;
}

/**
 * Converts a cpu string to number of cores
 * @param cpuStr
 * @returns {Number}
 */
function parseCpus(cpuStr) {
  const msMatches = /^([0-9]+)m$/.exec(cpuStr);
  const coreCountMatches = /^([0-9]+)$/.exec(cpuStr);

  if (msMatches) {
    return parseFloat(msMatches[1]) / 1000;
  }
  if (coreCountMatches) {
    return parseFloat(coreCountMatches[1])
  }
  throw new Error(`Invalid cpu "${cpuStr}"`);
}

/**
 * Converts a memory string to bytes
 * @param memStr
 * @returns {number}
 */
function parseMemory(memStr) {
  const matches = /^([0-9]+)(G|M|K)i$/.exec(memStr);

  if (!matches) {
    throw new Error(`Invalid memory string "${memStr}"`);
  }

  const val = parseFloat(matches[1]);
  const unit = {
    G: Math.pow(1024, 3),
    M: Math.pow(1024, 2),
    K: 1024,
  }[matches[2]];

  return val * unit;
}

function parsePods(podsStr) {
  const pods = parseInt(podsStr)

  if (isNaN(pods)) {
    throw new Error(`Inavlid pods string "${podsStr}"`);
  }

  return pods;
}


function flatMapAsync(arr, iterAsync) {
  return Promise.all(arr.map(iterAsync))
    .then(resArr => _.flattenDeep(resArr))
}

/**
 * Splits up an array into groups of arrays
 *
 * eg. chunkBy(['adam', 'andy', 'brian', 'bill', 'craig'], name => name.charAt(0));
 *     // --> [['adam', 'andy'], ['brian', 'bill'], ['craig']);
 */

function chunkBy(arr, iter) {
  return _.values(_.groupBy(arr, iter));
}