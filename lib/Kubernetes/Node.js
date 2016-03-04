"use strict";
const exec = require('../util/exec-promise');
const Pod = require('./Pod');
const parseKubectlFields = require('../util/parseKubectlFields');
const waitUntil = require('../util/waitUntil');
const co = require('co');

class Node {

	constructor(name) {
		this.name = name;
	}

	getAllPods() {
		const cmd = [
			`kubectl get pods --all-namespaces`,
			`-o jsonpath='{range .items[?(.spec.nodeName=="${this.name}")]}{.metadata.namespace} {.metadata.name} {end}'`,
			`| xargs -n 2`
		].join(' ');

		return exec(cmd)
			.then(out => out
				.split('\n')
				.filter(line => line.length)
				.map(line => {
					const podName = line.split(' ')[1];
					const podNamespace = line.split(' ')[0];

					return new Pod(podName, podNamespace);
				})
			);
	}

	getJson() {
		return exec(`kubectl get nodes ${this.name} -o json`)
			.then(out => JSON.parse(out));
	}

	makeUnschedulable() {
		return exec(`kubectl patch node ${this.name} -p '{"spec":{"unschedulable":true}}'`);
	}

	makeSchedulable() {
		return exec(`kubectl patch node ${this.name} -p '{"spec":{"unschedulable":false}}'`);
	}

	isReady() {
		return exec(`kubectl get node ${this.name}`)
			.then(out => parseKubectlFields(out))
			.then(fields => fields[0].STATUS === 'READY')
	}

	/**
	 * Removes all pods from the node,
	 * and marks it as unschedulable
	 */
	evacuate() {
		return co(function* () {
			// Make node "unschedulable"
			console.log(`Making node ${this.name} unschedulable`);
			yield this.makeUnschedulable();

			console.log(`Locating pods on node "${this.name}"`);
			const pods = (yield this.getAllPods())
			// Don't touch kube-system pods
				.filter(pod => pod.namespace !== 'kube-system');

			console.log(`Rescheduling all pods on "${this.name}"...`);

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

			console.log(`Node ${this.name} is decommissioned, and ready for deletion.`)
		}.bind(this));
	}
}

module.exports = Node;