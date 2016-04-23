"use strict";
const exec = require('../util/exec-promise');

class Ec2Instance {
	constructor(options) {
		this.instanceId = options.instanceId;
		this.protectedFromScaleIn = options.protectedFromScaleIn;
		this.lifecycleState = options.lifecycleState;
	}

	reboot() {
		return exec(
			`aws ec2 reboot-instances --instance-ids ${this.instanceId}`
		);
	}

	waitUntilRunning() {
		return exec(
			`aws ec2 wait instance-running --instance-ids ${this.instanceId}`
		);
	}
}

Ec2Instance.LIFECYCLE_IN_SERVICE = 'InService';

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

			return new Ec2Instance({
				instanceId: json.Reservations[0].Instances[0].InstanceId
			});
		})
};

module.exports = Ec2Instance;
/*
 kubectl get nodes -o json` and find your server's metadata.labels['kuberentes.io/hostname']

 Then use that to describe `aws ec2 describe-instances --filter Name=private-dns-name,Values=[internal hostname]`

 Then instance id is `results.Reservations[0].Instances[0].InstanceId`
*/
