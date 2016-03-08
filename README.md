Kube JS
=======

A Node.JS utility library for working with Kubernetes v1.x. This library provides some nice abstractions around the `kubectl` management that Kubernetes provides to provide some more advanced features. This assumes you are already familiar with Kubernetes concepts and we will leave that explanation to the numerous other resources.

Installation
------------

1. Ensure you have a stable version of `kubectl`

1. Cloud Management (optional)

	1. Install the [AWS CLI](http://docs.aws.amazon.com/cli/latest/userguide/installing.html) `sudo pip install --upgrade awscli` (working with v1.10.x)

1. Clone this repository

1. Run `npm install`

Usage
-----

Components have been created that correspond to Kubernetes components

### Cluster

The top level cluster management.

#### getAllNodes()

Returns all the nodes in the currently selected cluster.


### Node

Advanced Node scheduling is needed to properly scale a Kubernetes cluster. The `kubectl` tool doesn't provide a one-shot command to aid with that yet.

#### getAllPods()

Returns all Pods that are running on this Node

#### makeUnschedulable() / makeSchedulable()

Disable / Enable scheduling on this Node



### Replication Controller
These help manage pods across the cluster so we can modify scaling.



### Pod
An individual worker representing containers 

#### getReplicationController()

Gets the Replication Controller that created this pod.

#### deletePod()

Deletes this pod. The Replication Controller will take of rescheduling.

Motivation
----------

The `kubectl` provided by the Kubernetes team provides a great start for basic interaction with a Kubernetes cluster. We have some more advanced scheduling needs with some longer running containers and 0 downtime requirements. We use `kubectl` under the hood to provide JSON output to this Javascript SDK of sorts. Javascript/Node was chosen because `kubectl` was able to output and intake JSON as well as Node's good support for executing external tools.

Todo
----

* Tests! - Mock the exec of kubectl to ensure we are sending commands properly.
* Logo? - Every cool project has a logo