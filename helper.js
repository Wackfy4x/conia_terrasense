function getOffset(currentPage = 1, listPerPage) {
    return (currentPage - 1) * [listPerPage]
}

function emptyorRows(rows) {
    return !rows ? [] : rows;
}

module.exports = {
    getOffset,
    emptyorRows
}
