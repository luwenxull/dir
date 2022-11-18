const { stat, readFile, readdir } = require('fs/promises')
const { parseArgs } = require('util')
const { normalize } = require('path')
const zlib = require('zlib')
const process = require('process')

const { values } = parseArgs({
  args: process.argv.slice(2), options: {
    root: {
      type: 'string',
    }
  }
})

if (!Object.prototype.hasOwnProperty.call(values, 'root')) {
  throw new Error('Root directory not specified')
}

// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true })

fastify.register(require('@fastify/static'), {
  root: values.root,
})

// Run the server!
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

(async () => {
  fastify.get('/api/file', async (request, reply) => {
    const { path = '' } = request.query
    const abp = normalize(`${values.root}/${path}`)
    if (!abp.startsWith(values.root)) {
      throw new Error('Invalid path')
    }
    const st = await stat(abp)
    if (st.isDirectory()) {
      const files = await readdir(abp, {
        withFileTypes: true
      })
      reply.header('Content-Type', 'application/json;charset=utf-8')
      reply.header('Content-Encoding', 'gzip')
      reply.send(await new Promise((rsl, rej) => {
        zlib.gzip(
          JSON.stringify(
            files
              .filter(file => !file.name.startsWith('.'))
              .sort((a, b) => {
                const aIsDir = a.isDirectory(), bIsDir = b.isDirectory()
                if (aIsDir === bIsDir) {
                  return a.name.localeCompare(b.name)
                }
                return aIsDir ? -1 : 1
              })
              .map(file => ({ name: file.name, isDir: file.isDirectory() })),
          ),
          (err, buffer) => {
            if (err) rej(err)
            else rsl(buffer)
          }
        )
      }))
    } else {
      // const buffer = await readFile(abp)
      // const data = await fileTypeFromBuffer(buffer);
      // if (data) {
      //   reply.header('Content-Type', data.mime)
      // }
      // reply.send(buffer)
      return reply.sendFile(path)
    }
  })

  start()
})()

process.on('warning', console.warn)
