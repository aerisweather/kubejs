"use strict";
const exec = require('../util/exec-promise');
const co = require('co');
const ReplicationController = require('./ReplicationController');

class Pod {
	constructor(name, namespace) {
		this.name = name;
		this.namespace = namespace;
	}

	getJson() {
		return exec(`kubectl get pod ${this.name} --namespace ${this.namespace} -o json`)
			.then(out => JSON.parse(out));
	}

	getReplicationController() {
		return co(function* () {
			const json = yield this.getJson();
			const createdBy = JSON.parse(json.metadata.annotations['kubernetes.io/created-by']);

			return new ReplicationController(createdBy.reference.name, this.namespace);
		}.bind(this));
	}

	deletePod() {
		return exec(`kubectl delete pod ${this.name} --namespace ${this.namespace}`);
	}
}

module.exports = Pod;

