"use strict";
const exec = require('../util/exec-promise');
const Pod = require('./Pod');
const parseKubectlFields = require('../util/parseKubectlFields');
const waitUntil = require('../util/waitUntil');
const co = require('co');
const _ = require('lodash');

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
			.then(fields => /^Ready/.test(fields[0].STATUS ))
	}

	/**
	 * Removes all pods from the node,
	 * and marks it as unschedulable
	 */
	evacuate(batchSize) {
		batchSize = (batchSize === undefined) ? 5 : batchSize;
		return co(function* () {
			// Make node "unschedulable"
			console.log(`Making node ${this.name} unschedulable`);
			yield this.makeUnschedulable();

			console.log(`Locating pods on node "${this.name}"`);
			const pods = (yield this.getAllPods())
			// Don't touch kube-system pods
				.filter(pod => pod.namespace !== 'kube-system');

			console.log(`Rescheduling all pods on "${this.name}" in groups of ${batchSize}...`);

			const podGroups = _.chunk(pods, batchSize);

			// Batch these
			for (let podGroup of podGroups) {

				// Scale up RCs
				var scaleUpOps = [];
				for (let pod of podGroup) {
					const rc = yield pod.getReplicationController();
					pod.foundRc = rc;
					console.log(`Scaling up ${rc.name} (+1)`);
					scaleUpOps.push(rc.scaleDelta(+1));
				}
				yield Promise.all(scaleUpOps);

				// Wait for scaling to be done
				var waitOps = [];
				for (let pod of podGroup) {
					console.log(`Waiting for pods on ${pod.foundRc.name} to be ready`);
					waitOps.push(pod.foundRc.waitForPods());
				}
				yield Promise.all(waitOps);

				// wait a little bit more, too, for processes to start up
				yield new Promise(res => setTimeout(res, 10000));

				// Delete old pods
				var deleteOldPods = [];
				for (let pod of podGroup) {
					console.log(`Deleting pod ${pod.name}`);
					deleteOldPods.push(pod.deletePod());
				}
				yield Promise.all(deleteOldPods);

				// Scale down
				var scaleDownOps = [];
				for (let pod of podGroup) {
					console.log(`Scaling down pod ${pod.foundRc.name}`);
					scaleDownOps.push(pod.foundRc.scaleDelta(-1));
				}
				yield Promise.all(scaleDownOps);
			}

			console.log(`Node ${this.name} is decommissioned, and ready for deletion.`)
		}.bind(this));
	}
}

module.exports = Node;