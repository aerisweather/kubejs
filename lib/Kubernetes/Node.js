"use strict";
const exec = require('../util/exec-promise');
const Pod = require('./Pod');

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
}

module.exports = Node;