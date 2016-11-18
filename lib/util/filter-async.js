/**
 * @param {Array<T>} list
 * @param {(T):Promise<Boolean>} filter
 * @returns {Promise<T[]>}
 */
function filterAsync(list, filter) {
  return Promise
    .all(
      list.map(item => filter(item)
        .then(filterRes => ({ filterRes, item }))
      )
    )
    .then(filterResults => filterResults
      .filter(({ item, filterRes }) => filterRes)
      .map(({ item, filterRes }) => item)
    );
}

module.exports = filterAsync;