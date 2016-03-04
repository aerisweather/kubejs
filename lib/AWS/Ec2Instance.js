"use strict";
const exec = require('../util/exec-promise');

class Ec2Instance {
	constructor(instanceId) {
		this.instanceId = instanceId;
	}
}

Ec2Instance.fromNode = (node) => {
	return node.getJson()
		.then(nodeJson => {
			const privateDnsName = nodeJson.metadata.labels['kubernetes.io/hostname'];

			return exec(
				`aws ec2 describe-instances --filter ` +
				`Name=private-dns-name,Values=${privateDnsName}`
			);
		})
		.then(out => JSON.parse(out))
		.then(json => {
			if (!json.Reservations.length) {
				return undefined;
			}

			return new Ec2Instance(json.Reservations[0].Instances[0].InstanceId);
		})
};

module.exports = Ec2Instance;
/*
 kubectl get nodes -o json` and find your server's metadata.labels['kuberentes.io/hostname']

 [2:11]
 Then use that to describe `aws ec2 describe-instances --filter Name=private-dns-name,Values=[internal hostname]`

 [2:13]
 Then instance id is `results.Reservations[0].Instances[0].InstanceId`
*/
