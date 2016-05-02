const assert = require('assert'),
	Ec2Instance = require('../../lib/AWS/Ec2Instance'),
	fs = require('fs-extra'),
	mockery = require('mockery'),
	sinon = require('sinon');

describe("AWS - AutoScalingGroup", function () {

	beforeEach(() => {
		mockery.enable({
			useCleanCache:      true,
			warnOnReplace:      false,
			warnOnUnregistered: false
		});
	});

	afterEach(() => {
		mockery.disable();
		mockery.deregisterAll();
	});

	describe("getDetails", function () {
		it("should getDetails()", function () {
			mockery.registerMock('../util/exec-promise', getDetailsMock());
			var AutoScalingGroup = require('../../lib/AWS/AutoScalingGroup');
			var asg = new AutoScalingGroup('my-auto-scaling-group');
			return asg.getDetails()
				.then(details => {
					assert.equal(details.AutoScalingGroupName, 'my-auto-scaling-group');
					assert.equal(details.Instances.length, 2);
					assert.equal(details.Instances[0].instanceId, 'i-abc123');
					assert.equal(details.Instances[0].lifecycleState, 'InService');
					assert.equal(details.Instances[0].protectedFromScaleIn, true);
				});
		});

	});

	describe('Set Instance Protection', function () {
		it("should enable instance protection on multiple", function () {
			var instances = [
				new Ec2Instance({instanceId: 'i-abc123'}),
				new Ec2Instance({instanceId: 'i-def456'})
			];
			var execMock = sinon.stub()
				.withArgs('aws autoscaling set-instance-protection --protected-from-scale-in --instance-ids i-abc123 i-def456 --auto-scaling-group-name my-auto-scaling-group')
				.returns(Promise.resolve('called successfully'));
			mockery.registerMock('../util/exec-promise', execMock);

			var AutoScalingGroup = require('../../lib/AWS/AutoScalingGroup');
			var asg = new AutoScalingGroup('my-auto-scaling-group');
			return asg.enableInstanceProtection(instances)
				.then(details => {
					assert.equal(details, 'called successfully');
				});
		});

		it("should disable instance protection on one", function () {
			var instances = [
				new Ec2Instance({instanceId: 'i-abc123'})
			];
			var execMock = sinon.stub()
				.withArgs('aws autoscaling set-instance-protection --no-protected-from-scale-in --instance-ids i-abc123 --auto-scaling-group-name my-auto-scaling-group')
				.returns(Promise.resolve('called successfully'));
			mockery.registerMock('../util/exec-promise', execMock);

			var AutoScalingGroup = require('../../lib/AWS/AutoScalingGroup');
			var asg = new AutoScalingGroup('my-auto-scaling-group');
			return asg.disableInstanceProtection(instances)
				.then(details => {
					assert.equal(details, 'called successfully');
				});
		});

		it("should set instance protection on all", function () {
			var execMock = getDetailsMock();
			execMock.withArgs('aws autoscaling set-instance-protection --protected-from-scale-in --instance-ids i-abc123 i-def456 --auto-scaling-group-name my-auto-scaling-group')
				.returns(Promise.resolve('called successfully'));
			mockery.registerMock('../util/exec-promise', execMock);

			var AutoScalingGroup = require('../../lib/AWS/AutoScalingGroup');
			var asg = new AutoScalingGroup('my-auto-scaling-group');
			return asg.enableInstanceProtectionOnAllInstances()
				.then(details => {
					assert.equal(details, 'called successfully');
				});
		});
	});

	describe("scaleIn", function() {
		it("should scale in", function() {
			var execMock = getDetailsMock(1);
			execMock.withArgs('aws autoscaling update-auto-scaling-group --auto-scaling-group-name my-auto-scaling-group --max-size 2 --desired-capacity 1')
				.returns(Promise.resolve('called successfully'));
			mockery.registerMock('../util/exec-promise', execMock);

			var AutoScalingGroup = require('../../lib/AWS/AutoScalingGroup');
			var asg = new AutoScalingGroup('my-auto-scaling-group');
			return asg.scaleIn(1)
				.then(details => {
					assert.equal(details, 'called successfully');
				});
		});

		it("should not scale in, too far", function() {
			var execMock = getDetailsMock(2);
			mockery.registerMock('../util/exec-promise', execMock);

			var AutoScalingGroup = require('../../lib/AWS/AutoScalingGroup');
			var asg = new AutoScalingGroup('my-auto-scaling-group');
			return asg.scaleIn(5)
				.catch(err => {
					assert.ok(err instanceof Error);
				});
		});

		it("should not scale in, not enough not protected from scale in", function() {
			var execMock = getDetailsMock();
			mockery.registerMock('../util/exec-promise', execMock);

			var AutoScalingGroup = require('../../lib/AWS/AutoScalingGroup');
			var asg = new AutoScalingGroup('my-auto-scaling-group');
			return asg.scaleIn(1)
				.catch(err => {
					assert.ok(err instanceof Error);
				});
		});
	});

	describe("scaleOut", function() {

		it("should scaleOut", function() {
			var execMock = getDetailsMock();
			execMock.withArgs('aws autoscaling update-auto-scaling-group --auto-scaling-group-name my-auto-scaling-group --max-size 4 --desired-capacity 3')
				.returns(Promise.resolve('called successfully'));
			mockery.registerMock('../util/exec-promise', execMock);

			var AutoScalingGroup = require('../../lib/AWS/AutoScalingGroup');
			var asg = new AutoScalingGroup('my-auto-scaling-group');
			return asg.scaleOut(1)
				.then(details => {
					assert.equal(details, 'called successfully');
				});
		});
	});
});

function getDetailsMock(numberToDisableProtection) {
	var stub = sinon.stub();
	const autoscalingDetails = fs.readJsonSync(__dirname + '/../mock/autoscaling-details.json');
	autoscalingDetails.AutoScalingGroups[0].Instances = autoscalingDetails.AutoScalingGroups[0].Instances.map((instance) => {
		if(numberToDisableProtection > 0) {
			instance.ProtectedFromScaleIn = false;
			numberToDisableProtection--;
		}
		return instance;
	});
	stub.withArgs('aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names my-auto-scaling-group')
		.returns(Promise.resolve(autoscalingDetails));
	return stub;
}