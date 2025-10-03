import { syncVimeoData } from "../services/fetchVimeoData";
syncVimeoData()
  .catch(console.error)
  .finally(() => process.exit());
