"use strict";
const exec = require('../util/exec-promise'),
	Ec2Instance = require('./Ec2Instance'),
	_ = require('lodash');

/**
 * Kubernetes workers in AWS should be managed by an AutoScalingGroup so they can be scaled in and out accordingly.
 */
class AutoScalingGroup {

	/**
	 * @param {string} autoScalingGroupName
	 */
	constructor(autoScalingGroupName) {
		this.groupName = autoScalingGroupName;
	}

	/**
	 * @returns {Promise} a promise that resolves to an array of Ec2Instances
	 */
	getDetails() {
		return exec(`aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names ${this.groupName}`)
			.then(autoScalingGroupsDetails => {
				if(autoScalingGroupsDetails[0]) {
					const autoScalingDetails = autoScalingGroupsDetails.AutoScalingGroups[0];
					autoScalingDetails.Instances = autoScalingDetails.Instances
						.map(instanceDetail => new Ec2Instance({
							instanceId: instanceDetail.InstanceId,
							protectedFromScaleIn: instanceDetail.ProtectedFromScaleIn,
							lifecycleState: instanceDetail.LifecycleState
						}));
					return autoScalingDetails
				}
				return null;
			})
	}

	/**
	 *
	 * @param {Ec2Instance[]} instances
	 * @returns {*}
	 */
	enableInstanceProtection(instances) {
		return this._setInstanceProtection(instances, AutoScalingGroup.PROTECTION_ENABLE);
	}

	/**
	 * @returns {*}
	 */
	enableInstanceProtectionOnAllInstances() {
		return this.getDetails()
			.then(autoScalingGroupDetails => {
				return this._setInstanceProtection(autoScalingGroupDetails.Instances, AutoScalingGroup.PROTECTION_ENABLE);
			});
	}

	/**
	 *
	 * @param {Ec2Instance[]} instances
	 * @returns {*}
	 */
	disableInstanceProtection(instances) {
		return this._setInstanceProtection(instances, AutoScalingGroup.PROTECTION_DISABLE);
	}

	/**
	 * Scale the cluster in by [amount] of servers. This is relative to servers currently in the auto scaling group (DesiredCapacity)
	 *
	 * @param {number} amount
	 * @returns {*}
	 */
	scaleIn(amount) {
		return this.getDetails()
			.then(autoScalingDetails => {
				// Validate amount
				if(!(autoScalingDetails.MaxSize >= amount && autoScalingDetails.DesiredCapacity >= amount)) {
					throw new Error(`Can't scale in that far. Requesting ${amount}, cluster is only ${autoScalingDetails.MaxSize}`);
				}

				// Ensure the correct number of instances are allowed to scale in.
				const instancesReady = autoScalingDetails.Instances.filter((ec2Instance) => {
					return !ec2Instance.protectedFromScaleIn && ec2Instance.lifecycleState == Ec2Instance.LIFECYCLE_IN_SERVICE;
				});
				if(instancesReady.length < amount) {
					throw new Error(`Instances ready for scale in (not ProtectedFromScaleIn) is ${instancesReady.length}, looking for ${amount}`);
				}
				return exec(`aws autoscaling update-auto-scaling-group --auto-scaling-group-name ${this.groupName} --max-size ${autoScalingDetails.MaxSize - amount} --desired-capacity ${autoScalingDetails.DesiredCapacity - amount}`);
			})
	}

	/**
	 *
	 * @param {number} amount
	 * @returns {Promise}
	 */
	scaleOut(amount) {
		if(amount > 0) {
			return exec(`aws autoscaling update-auto-scaling-group --auto-scaling-group-name ${this.groupName} --max-size ${autoScalingDetails.MaxSize + amount} --desired-capacity ${autoScalingDetails.DesiredCapacity + amount}`);
		}
		else {
			throw new Error(`Amount must be an integer > 0`);
		}
	}

	/**
	 * @param {Ec2Instance[]} instances
	 * @param {string} mode
	 * @private
	 */
	_setInstanceProtection(instances, mode) {
		if(instances instanceof Ec2Instance) {
			instances = [instances];
		}
		var protectionFlag;
		switch (mode) {
			case AutoScalingGroup.PROTECTION_ENABLE:
				protectionFlag = '--protected-from-scale-in';
				break;
			case AutoScalingGroup.PROTECTION_DISABLE:
				protectionFlag = '--no-protected-from-scale-in';
				break;
			default:
				throw new Error(`Incorrect mode speicified when setting instance protection. ${mode} was not a valid mode`);
		}
		return exec(`aws autoscaling set-instance-protection ${protectionFlag} --instance-ids ${_.map(instances, 'instanceId').join(' ')} --auto-scaling-group-name ${this.groupName}`);
	}


}
AutoScalingGroup.PROTECTION_ENABLE = 'enable';
AutoScalingGroup.PROTECTION_DISABLE = 'disable';

module.exports = AutoScalingGroup;