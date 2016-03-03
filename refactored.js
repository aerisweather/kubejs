const co = require('co');
const Node = require('./lib/Kubernetes/Node');

function main() {
	return co(function* () {
		"use strict";

		const nodeName = process.argv[2];
		if (!nodeName) { throw new Error('Missing node name arguments'); }

		const node = new Node(nodeName);

		// Make node "unschedulable"
		console.log(`Making node ${node.name} unschedulable`);
		yield node.makeUnschedulable();

		console.log(`Locating pods on node "${nodeName}"`);
		const pods = (yield node.getAllPods())
			// Don't touch kube-system pods
			.filter(pod => pod.namespace !== 'kube-system');

		console.log(`Rescheduling all pods on "${nodeName}"...`);

		// Scale up RCs
		for (let pod of pods) {
			const rc = yield pod.getReplicationController();

			console.log(`Scaling up ${rc.name} (+1)`);
			yield rc.scaleDelta(+1);

			// Wait for new pods to be ready
			console.log(`Waiting for pods on ${rc.name} to be ready`)
			yield rc.waitForPods();
			// wait a little bit more, too, for processes to start up
			yield new Promise(res => setTimeout(res, 10000));

			// Delete old pod
			console.log(`Deleting pod ${pod.name}`);
			yield pod.deletePod();

			// Scale rc back down
			yield rc.scaleDelta(-1);
		}

		console.log(`Node ${nodeName} is decommissioned, and ready for deletion.`)
	});
}

main()
	.then(() => {
		process.exit(0);
	}, (err) => {
		console.error(err.name, err.stack);
		process.exit(1);
	});


