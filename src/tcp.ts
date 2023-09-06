import Net from 'net'
import jwt from 'jsonwebtoken'
import { Delay, Loop, Uid, log, env } from 'utils'

interface iHostCb {
    (data: Net.Socket | any): void
}

interface ServerSocket extends Net.Socket {
    authenticate: (token: string) => any | null /** Nullable **/
}

interface ClientSocket extends Net.Socket {
    authenticate: (token: string) => void
}

export class NetServer {

    host: string
    port: number
    alias: string
    server: Net.Server
    clients: Net.Socket[] = []
    secret: string

    constructor({ host, port, secret }: { host?: string, port?: number, secret?: string }, cb: (client: ServerSocket) => void) {

        this.host = host ?? '127.0.0.1'
        this.port = port ?? 0
        this.secret = secret ?? env.secret ?? 'secret'
        this.alias = `TCP-Host ${this.host} ${this.port}`
        this.create(cb)

    }

    verify = (token) => {
        try {
            return jwt.verify(token, this.secret)
        } catch (err) {
            return null
        }
    }

    create = (cb: iHostCb) => {

        try {

            this.server = Net.createServer()
            this.server.listen(this.port, this.host, () => {

                log.success(`${this.alias}: Started!`)

                this.server.on('connection', (client: Net.Socket | any) => {

                    const alias = `${client.remoteAddress}:${client.remotePort}`
                    log.success(`${this.alias}: ${alias} / Connected!`)

                    client.id = Uid()
                    client.isAuthenticated = false
                    client.decoded = null

                    this.clients.push(client)

                    client.authenticate = (token) => {

                        if (client.isAuthenticated) { return client.decoded } else {

                            const decoded = this.verify(token)
                            if (decoded) {
                                client.isAuthenticated = true
                                client.decoded = decoded
                                log.success(`${this.alias}: Authorized!`)
                                return decoded
                            } else {
                                log.warn(`${this.alias}: Authorization failed / ${token}`)
                                client.write('Unauthorization failed!\r\n')
                                Delay(() => client.destroy(), 2500)
                                return null
                            }

                        }

                    }

                    client.on('close', (data: any) => {

                        let index = this.clients.findIndex((o) => o.remoteAddress === client.remoteAddress && o.remotePort === client.remotePort)
                        index !== -1 && this.clients.splice(index, 1)
                        log.warn(`${this.alias}: ${alias} / [idx_${index}] Disconnected!`)

                    })

                    cb(client)

                })

            })

        } catch (err) {

            log.error(`${this.alias}: While starting ${err.message}`)
            this.port !== 0 && Delay(() => this.create(cb), 15 * 1000)

        }

    }

}

export class NetClient {

    client
    config
    last = Date.now()
    isRestarting = false
    callback: (client: ClientSocket) => void

    constructor({ host, port, token }: { host?: string, port?: number, token?: string }, cb: (client: ClientSocket) => void) {

        this.config = {
            host: host ?? '127.0.0.1',
            port: port ?? 0,
            token: token ?? '#',
        }
        this.callback = cb
        this.start()

        Loop(() => {
            /** Consider ( as channel broken ) when server doesn't send message for over 30 (+~5) second **/
            if (Date.now() - this.last > (30 * 1000)) {
                this.last = Date.now()
                this.restart()
            }

        }, 5 * 1000)

    }

    restart = () => {

        if (this.isRestarting) { return 0 }
        this.isRestarting = true

        try {
            log.warn(`NetClient: Removing current connections and listeners ...`)
            this.client.removeAllListeners()
            this.client.destroy()
        } catch (err) {
            log.error(`NetClient: While Removing current connections: ${err.message}`)
        } finally {
            Delay(() => {
                this.isRestarting = false
                this.start()
            }, 15 * 1000)
        }

    }

    start = () => {

        log.success(`NetClient: Starting a new NET.SOCKET ...`)

        this.client = new Net.Socket()

        this.client.authenticate = (token) => this.client.write(token)

        this.client.connect(this.config, () => {
            log.success(`NetClient: Connection established with the server`)
            this.callback(this.client)
        })

        /* this.client.on('data', (chunk: any) => {
            try {
                this.last = Date.now()
                this.log(`Data received from the server [${chunk.toString().length}]`)
                this.callback(chunk)
            } catch (err) { }
        }) */

        this.client.on('error', (err: any) => {
            log.error(`NetClient: On.Error / ${err.message}`)
            this.restart()
        })

        this.client.on('close', () => {
            log.warn(`NetClient: On.Close triggered!`)
            this.restart()
        })

        this.client.on('end', () => {
            log.warn(`NetClient: On.End triggered!`)
            this.restart()
        })

    }

}
