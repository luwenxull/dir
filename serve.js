// const { readFile } = require('fs')
const { stat, readFile, readdir } = require('fs/promises')
const zlib = require('zlib')
const process = require('process')


// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true })

// Run the server!
const start = async () => {
  try {
    await fastify.listen({ port: 3000 })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

(async () => {
  const { fileTypeFromBuffer } = await import('file-type')
  fastify.get('/', async (request, reply) => {
    const { path } = request.query
    const st = await stat(path)
    if (st.isDirectory()) {
      const files = await readdir(path, {
        withFileTypes: true
      })
      reply.header('Content-Type', 'application/json;charset=utf-8')
      reply.header('Content-Encoding', 'gzip')
      reply.send(await new Promise((rsl, rej) => {
        zlib.gzip(
          JSON.stringify(
            files
              .filter(file => !file.name.startsWith('.'))
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(file => ({ name: file.name, isDir: file.isDirectory() })),
          ),
          (err, buffer) => {
            if (err) rej(err)
            else rsl(buffer)
          }
        )
      }))
    } else {
      const buffer = await readFile(path)
      const data = await fileTypeFromBuffer(buffer);
      if (data) {
        reply.header('Content-Type', data.mime)
      }
      reply.send(buffer)
    }
  })

  start()
})()

process.on('warning', console.warn)
