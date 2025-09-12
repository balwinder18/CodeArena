
async function connectRedis() {
  const { createClient } = await import("redis");

  const client = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
    },
  });

  client.on("error", (err) => console.error("Redis Client Error", err));

  if (!client.isOpen) {
   
    await client.connect();
 console.log("Redis Connected");
  }


  try {
    await client.set("healthcheck", "ok");
    const result = await client.get("healthcheck");
    console.log("Redis health check:", result);
  } catch (err) {
    console.error("Redis health check failed:", err);
  }

  return client;
}

module.exports = connectRedis;
