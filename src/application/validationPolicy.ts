import { z } from "zod";

// Pages and workers use script-src 'self'. Keep schema validation independent of generated functions.
z.config({ jitless: true });
