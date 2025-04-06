import winston from "winston";

// Create the logger, but only configure it for development
const logger = winston.createLogger({
  // Only set up transports and logging if in development
  ...(process.env.NODE_ENV !== "production" && {
    level: "info", // Log "info" level and above (info, warn, error)
    format: winston.format.combine(
      winston.format.timestamp(), // Add timestamps to logs
      winston.format.json() // Format logs as JSON
    ),
    transports: [
      // Write error logs to a file
      new winston.transports.File({ filename: "error.log", level: "error" }),
      // Write all logs to another file
      new winston.transports.File({ filename: "combined.log" }),
      // Also show logs in the console with a simple format
      new winston.transports.Console({
        format: winston.format.simple(),
      }),
    ],
  }),
});

// In production, make logger methods no-ops (do nothing)
if (process.env.NODE_ENV === "production") {
  const noop: winston.LeveledLogMethod = () => logger;
  logger.info = noop;
  logger.error = noop;
  logger.warn = noop;
  logger.debug = noop;
}

export default logger;