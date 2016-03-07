const co = require('co');
const Cluster = require('../lib/Kubernetes/Cluster');
const _ = require('lodash');

const cluster = new Cluster();

cluster.getAllNodes()
	.then(nodes => co(function* () {
		return yield nodes.reduce((nodePods, node) => Object.assign(nodePods, {
			[node.name]: node.getAllPods()
		}), {})
	}))
	.then(nodePods => {
		// Display
		_.forEach(nodePods, (pods, nodeName) => {
			console.log(nodeName);
			pods.map(pod => console.log(`\t${pod.namespace}\t${pod.name}`));
			console.log();
		});
	})
	.catch(err => console.log(err.stack));