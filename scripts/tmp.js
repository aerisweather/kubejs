#!/usr/bin/env node
const co = require('co');
const Node = require('../lib/Kubernetes/Node');
const Ec2Instance = require('../lib/AWS/Ec2Instance');
const ReplicationControllers = require('../lib/Kubernetes/ReplicationController');
const waitUntil = require('../lib/util/waitUntil');
const Cli = require('admiral-cli');

const cli = new Cli({ exitOnHelp: true })
	.option({
		name: 'namespace',
		description: 'k8s namespace in which pods will be redistributed',
		longFlag: '--namespace',
		required: true,
		length: 1
	})
	.option({
		name: 'node',
		description: 'Node to restart',
		longFlag: '--node',
		required: true,
		length: 1
	});

cli.parse();

function scaleDown() {
	return co(function* () {
		// Locate all ec2 instances
	  const nodes = yield new Cluster().getAllNodes();
		const ec2Instances = yield nodes.map(n => Ec2Instance.fromNode(n));
		
		const instanceToRemove = ec2Instances[0];
		const	instancesToKeep = ec2Instances.slice(1);
		
		
		const autoScalingGroup = yield somehowGetScalinggz
		// Protect other instances from termination
		yield instanceToRemove.allowTer
		yield instancesToKeep.map(inst => inst.forbidTermination());
		
		
		
		const nodeToRemove = nodes[0]; 

		const ec2ToRemove = yield Ec2Instance.fromNode(node);

		yield ec2.reboot();
		yield ec2.waitUntilRunning();

		yield waitUntil(() => node.isReady());

		yield node.makeSchedulable();

		const rcs = yield ReplicationControllers.getAll(cli.params.namespace);
		yield rcs.map(rc => rc.reschedule());
	});
}

