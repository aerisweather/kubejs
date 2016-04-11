#!/usr/bin/env node
const co = require('co');
const Cluster = require('../lib/Kubernetes/Cluster');
const execp = require('../lib/util/exec-promise');
const _ = require('lodash');

const cluster = new Cluster();

cluster.getAllNodes()
	.then(nodes => {
		return Promise.all(nodes.map((node) => node.getExternalIp()));
	})
	.then(externalIps => {
		return externalIps.map((externalIp) => `http://${externalIp}:4194`);
	})
	.then(cAdvisorUrls => {
		return execp('which xdg-open')
			.then(() => {
				// We have xdg-open (Linux)
				cAdvisorUrls.map(cAdvisorUrl => execp(`xdg-open ${cAdvisorUrl}`));
			})
			.catch(() => {
				// Hopefully we have open (everyone does, but macs use this)
				cAdvisorUrls.map(cAdvisorUrl => execp(`open ${cAdvisorUrl}`));
			})
	})
	.catch(err => console.log(err.stack));