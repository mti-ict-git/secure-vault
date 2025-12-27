import { server } from "./server.js";
import { config } from "./config.js";

server.listen({ port: config.port, host: "0.0.0.0" }).then((address) => {
  server.log.info({ address }, "backend listening");
});
