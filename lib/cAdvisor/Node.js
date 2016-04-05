"use strict";
const httpGet = require('../util/http-get-promise'),
	_ = require('lodash');

class Node {

	constructor(nodeUrl) {
		this.API_URL_PREFIX = '/api/v1.3';
		this.url = nodeUrl;

		//@todo Cache this better
		this.containers = {};
	}

	/**
	 * Find the container in the cluster and return the stats for it.
	 * @param namespace - The namespace to query "/" is root, "system.slice", etc.
	 */
	getContainers(namespace) {
		if(this.containers[namespace]) {
			return this.containers[namespace];
		}
		namespace = (namespace === undefined) ? '/' : namespace;
		return this._makeRequest('/containers/' + namespace)
			.then((namespaceData) => {
				if (namespaceData.subcontainers) {
					return namespaceData.subcontainers.map((container) => container.name);
				}
				return [];
			})
			.then(results => {
				this.containers[namespace] = results;
				return results;
			})
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
		return this.getContainers(namespace)
			.then(containers => {
				// Get find lmctfy id (if we have it)
				var matchingContainers = containers.filter((containerLmctfyId) => containerLmctfyId.match(new RegExp(`docker-${containerId}`, 'g')));
				if(matchingContainers.length === 1) {
					return matchingContainers[0];
				}
				return null;
			})
			.then(containerLmctfyId => {
				if(containerLmctfyId !== null) {
					return this._makeRequest('/containers' + containerLmctfyId);
				}
				return null;
			});
	}

	_makeRequest(apiQuery) {
		return httpGet(this.url + this.API_URL_PREFIX + apiQuery);
	}

}

module.exports = Node;
