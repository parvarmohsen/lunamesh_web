export const deviceNameParser = (name: string) => {
  if (!name) {
    return "UNK";
  }
  // replace the meshtastic in name, with lunamesh, regardless of case
  return name.replace(/meshtastic/i, "lunamesh");
};
