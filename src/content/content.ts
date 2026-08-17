import { logger } from "../shared/logger";

// Milestone 1 only establishes the entry point. It performs no page detection or form interaction.
logger.debug("Content-script foundation loaded", { hostname: window.location.hostname });
