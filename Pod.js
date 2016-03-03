"use strict";
const exec = require('./exec-promise');

class Pod {
	constructor(name, namespace) {
		this.name = name;
		this.namespace = namespace;
	}

	getJson() {
		return exec(`kubectl get pod ${this.name} --namespace ${this.namespace} -o json`)
			.then(out => JSON.parse(out));
	}

	getRc() {

	}
}

module.exports = Pod;

