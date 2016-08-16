# v1.2.0

* `stats summary`: show all namespaces, by default
* `stats summary`: aggregate values by container
* `cluster resources`: Include cAdvisor stats in output

# v1.1.1

* Fix CPU calculation in `stats summary`
* Improve formatting in `stats summary`

# v1.1.0

* Add `cluster resources` command
* Improve `stats summary` command's reporting of CPU usage.
  Results may still be a little wonky, but before they were always `0`.

# v1.0.4

* cAdvisor: Do not attempt to query k8s controller node