// Workers should be managed by an autoscaling group
/**
 * Scale In - Decrease the size of the autoscaling group. Provide instanceIds to scale in, otherwise some will be chosen for you if a number is provided.
 *
 * `aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names k8s-coreos-v1-1-8-AutoScaleWorker-1DI3Z338QGHZ9`
 *
 * `aws autoscaling set-instance-protection --instance-ids i-12345 i-56789 --auto-scaling-group-name k8s-coreos-v1-1-8-AutoScaleWorker-1DI3Z338QGHZ9`
 *
 *
 */