"use strict";
const CrispCache = require('crisp-cache'),
	co = require('co'),
	request = require('request'),
	_ = require('lodash');

class Node {

	constructor(nodeUrl) {
		this.API_URL_PREFIX = '/api/v1.3';
		this.url = nodeUrl;
		this.getContainers = CrispCache.wrap(this._getContainers.bind(this), {
			createKey:         (namespace) => namespace,
			parseKey:          (key) => [key],
			defaultExpiresTtl: 20 * 60 * 1000
		});
	}

	/**
	 * Find the container in the cluster and return the stats for it.
	 *
	 * **NOTE:** This is cached for the duration of the script. Not a big deal for our short running CLI examples but
	 * could lead to issues for someone.
	 *
	 * @param namespace - The namespace to query "/" is root, "system.slice", etc.
	 * @param cb
	 */
	_getContainers(namespace, cb) {
		namespace = (namespace === undefined) ? '/' : namespace;
		this._makeRequest('/containers/' + namespace)
			.then((namespaceData) => {
				if (namespaceData.subcontainers) {
					return cb(null, namespaceData.subcontainers.map((container) => container.name));
				}
				return cb(null, []);
			})
			.catch(err => cb(err));
	}

	/**
	 * Gets a container by docker hash, a sha1 string.
	 *
	 * @param {string} containerId - A docker containerId , a sha1 hash, may be prefixed with docker://
	 * @param {string} [namespace='system.slice'] - The namespace of the container, most are in 'system.slice' so we default to that.
	 */
	getContainerByContainerId(containerId, namespace) {
		return co(function*() {
			containerId = containerId.replace(/^docker:\/\//, '');
			namespace || (namespace = 'system.slice');

			const containers = yield cb => this.getContainers(namespace, cb);

			// Get find lmctfy id (if we have it)
			var matchingContainers = containers.filter((containerLmctfyId) => containerLmctfyId.match(new RegExp(`docker-${containerId}`, 'g')));
			if (matchingContainers.length !== 1) {
				return null;
			}

			return yield this._makeRequest(`/containers${matchingContainers[0]}`);
		}.bind(this));
	}

	hasCAdvisor() {
		return co(function* () {
			try {
				yield this._makeRequest('/containers/', { timeout: 1500 });
				return true;
			}
			catch (err) {
				return false;
			}
		}.bind(this));
	}

	_makeRequest(endpoint, opts) {
		return co(function* () {
			opts = Object.assign({
				json: true,
				timeout: 30000
			}, opts);

			const url = this.url + this.API_URL_PREFIX + endpoint;
			const res = yield cb => request({
				url,
				json: opts.json,
				timeout: opts.timeout
			}, (err, res) => cb(err, res));

			if (res.statusCode >= 400) {
				throw new Error(`Request to ${url} returned a ${res.statusCode}: \n ${res.body}`);
			}

			return res.body;
		}.bind(this));
	}

}

Node.fromKubernetesNode = k8sNode => co(function* () {
	const extNodeIp = yield k8sNode.getExternalIp();
	return new Node(`http://${extNodeIp}:4194`);
});

module.exports = Node;
