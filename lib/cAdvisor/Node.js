"use strict";
const CrispCache = require('crisp-cache'),
	httpGet = require('../util/http-get-promise'),
	_ = require('lodash');

class Node {

	constructor(nodeUrl) {
		this.API_URL_PREFIX = '/api/v1.3';
		this.url = nodeUrl;
		this.getContainers = CrispCache.wrap(this._getContainers.bind(this), {
			createKey:         (namespace) => namespace,
			parseKey:          (key) => [key],
			defaultExpiresTtl: 10 * 60 * 1000
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
		containerId = containerId.replace(/^docker:\/\//, '');
		namespace = (namespace === undefined) ? 'system.slice' : namespace;
		// Get containers
		return new Promise((resolve, reject) => {
			this.getContainers(namespace, (err, results) => {
				if (err) {
					return reject(err);
				}
				return resolve(results);
			})
		})
			.then(containers => {
				// Get find lmctfy id (if we have it)
				var matchingContainers = containers.filter((containerLmctfyId) => containerLmctfyId.match(new RegExp(`docker-${containerId}`, 'g')));
				if (matchingContainers.length === 1) {
					return matchingContainers[0];
				}
				return null;
			})
			.then(containerLmctfyId => {
				if (containerLmctfyId !== null) {
					return this._makeRequest('/containers' + containerLmctfyId);
				}
				return null;
			});
	}

	_makeRequest(apiQuery) {
		const queryUrl = this.url + this.API_URL_PREFIX + apiQuery;
		return httpGet(queryUrl)
			.then((result) => {
				result._url = queryUrl;
				return result;
			})
	}

}

module.exports = Node;
