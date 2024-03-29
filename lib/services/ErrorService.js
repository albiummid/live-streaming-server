async function buildError(err, source){
    return {
        kind: 'error',
        source: source,
        error: err.message,
        code: err.code,
        stack: err.stack
    }
}

module.exports = {
    buildError
}