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

function main() {
	return co(function* () {
	  const node = new Node(cli.params.node);

		console.log(`Evacuating node ${node.name}...`);
		yield node.evacuate();
		console.log(`Node evacuation complete.`);

		const ec2 = yield Ec2Instance.fromNode(node);

		console.log(`Rebooting ec2 instance "${ec2.instanceId}"`);
		yield ec2.reboot();
		yield ec2.waitUntilRunning();
		console.log(`Ec2 instance "${ec2.instanceId}" up and running`);

		console.log(`Waiting for node "${node.name}" to be ready...`);
		yield waitUntil(() => node.isReady());
		console.log(`Node "${node.name}" is ready.`);


		console.log(`Making node "${node.name}" schedulable again`);
		yield node.makeSchedulable();

		console.log(`Rescheduling all pods in namespace ${cli.params.namespace}`);
		const rcs = yield ReplicationControllers.getAll(cli.params.namespace);
		yield rcs.map(rc => rc.reschedule());
		console.log(`Pods rescheduled`);

		console.log(`Reboot of node "${node.name}" complete.`);
	});
}


main()
	.then(() => {
		process.exit(0);
	}, (err) => {
		console.error(err.name, err.stack);
		process.exit(1);
	});


