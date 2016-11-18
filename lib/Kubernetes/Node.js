"use strict";
const exec = require('../util/exec-promise');
const Pod = require('./Pod');
const parseKubectlFields = require('../util/parseKubectlFields');
const waitUntil = require('../util/waitUntil');
const co = require('co');
const stream = require('stream');
const _ = require('lodash');

class Node {

	constructor(name) {
		this.name = name;
		this.NAMESPACE_ALL = 'ALL_NAMESPACES'
	}

	getAllPods(namespace) {
		return this.getAllPodsJson(namespace)
			.then(pods => pods.map(pod =>
				new Pod(pod.metadata.name, pod.metadata.namespace, pod.status.phase))
			);
	}

	getAllPodsJson(namespace) {
		namespace = namespace === undefined ? this.NAMESPACE_ALL : namespace;

		var namespaceSelector = '--all-namespaces';
		if(namespace !== this.NAMESPACE_ALL) {
			namespaceSelector = '--namespace='+namespace;
		}
		const cmd = `kubectl get pods ${namespaceSelector} -o json`;

		return exec(cmd, {maxBuffer: 5* 1024 * 1024})
			.then(out => JSON.parse(out).items
				.filter(pod => pod.spec.nodeName === this.name && pod.status.phase === "Running")
			);
	}

	getJson() {
		return exec(`kubectl get nodes ${this.name} -o json`)
			.then(out => JSON.parse(out));
	}

	getExternalIp() {
		return this.getJson().then((nodeInfo) => {
			if(nodeInfo.status.addresses) {
				const externalIpEntry = nodeInfo.status.addresses.filter((addressEntry) => addressEntry.type === 'ExternalIP');
				if(externalIpEntry.length === 1) {
					return externalIpEntry[0].address;
				}
			}
			return null;
		})
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

	hasCAdvisor() {
		return co(function* () {
			const caNode = yield require('../cAdvisor/Node')
				.fromKubernetesNode(this);

			return yield caNode.hasCAdvisor();
		}.bind(this));
	}
}

Node.fromJson = json => new Node(json.metadata.name);

module.exports = Node;