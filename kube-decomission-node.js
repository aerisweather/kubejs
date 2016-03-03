const execSync = require('child_process').execSync;

const nodeName = process.argv[2];

if (!nodeName) { throw new Error('No node defined'); }


// Make node "unschedulable"
console.log(`Making node "${nodeName}" unschedulable`);
execSync(`kubectl patch node ${nodeName} -p '{"spec":{"unschedulable":true}}'`);

console.log(`Locating pods on node "${nodeName}"`);
const pods = execSync([
	`kubectl get pods --all-namespaces`,
	`-o jsonpath='{range .items[?(.spec.nodeName=="${nodeName}")]}{.metadata.namespace} {.metadata.name} {end}'`,
	`| xargs -n 2`
].join(' '))
	.toString('utf8')
	.split('\n')
	.filter(line => line.length)
	.map(line => {
		const namespace = line.split(' ')[0];
		const name = line.split(' ')[1];
		const json = getPodJson(name, namespace);

		return { name, namespace, json };
	})
	// Don't touch kube-system pods
	.filter(pod => pod.namespace !== 'kube-system');


// Reschedule all pods
console.log(`Rescheduling all pods on "${nodeName}"...`);
pods.forEach(podObj => {
	const rc = getPodRc(podObj.json);
	const rcJson = JSON.parse(
		execSync(`kubectl get rc ${rc} --namespace ${podObj.namespace} -o json`).toString('utf8')
	);

	const targetReplicas = rcJson.spec.replicas + 1;

	// Scale up rc, to get a new pod on a different node
	console.log(`Scaling ${rc} up to ${targetReplicas}`);
	execSync(`kubectl scale --replicas=${targetReplicas} rc ${rc} --namespace ${podObj.namespace}`);
});

// wait for scaling up to complete, before deleting old pods
console.log(`Waiting for rescheduled pods to start up...`)
waitForPodsReady()
	.then(() => {
		pods.forEach(podObj => {
			const rc = getPodRc(podObj.json);
			const rcJson = JSON.parse(
				execSync(`kubectl get rc ${rc} --namespace ${podObj.namespace} -o json`).toString('utf8')
			);

			const targetReplicas = rcJson.spec.replicas - 1;

			// Delete the old pod
			console.log(`Deleting pod "${podObj.name}"`);
			execSync(`kubectl delete pod ${podObj.name} --namespace ${podObj.namespace}`)

			// Scale down rc back to original setting
			console.log(`Scaling ${rc} down to ${targetReplicas}`);
			execSync(`kubectl scale --replicas=${targetReplicas} rc ${rc} --namespace ${podObj.namespace}`);
		});

		console.log(`Node ${nodeName} is decommissioned, and ready for deletion.`)
		process.exit(0);
	});


function getPodRc(podJson) {
	const createdBy = JSON.parse(podJson.metadata.annotations['kubernetes.io/created-by']);

	return createdBy.reference.name;
}

function getPodJson(name, namespace) {
	return JSON.parse(
		execSync(`kubectl get pod ${name} --namespace ${namespace} -o json`).toString('utf8')
	);
}

function waitForPodsReady() {
	return new Promise(resolve => {
		const getStatuses = () => execSync(`kubectl get pods --all-namespaces`)
			.toString('utf8')
			.split('\n').filter(line => line.length)
			.map(line => line.split(' ').filter(item => item.length))
			.slice(1)
			.map(row => row[3]);

		const int = setInterval(() => {
			if (getStatuses().every(st => st === 'Running')) {
				clearInterval(int);
				// wait a little bit, just to make sure scripts are initialized
				setTimeout(() => resolve(), 1000 * 10);
			}
		}, 2000);
	});
}