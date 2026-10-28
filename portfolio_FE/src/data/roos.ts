// The ROOS mark, drawn with box pieces for its outline and solid blocks for
// its body, so blanking the blocks leaves an outline (the loading screen
// fills it in). Shared by the hero and the sidebar's banner.
export const ROOS = `
██████╗  ██████╗  ██████╗ ███████╗
██╔══██╗██╔═══██╗██╔═══██╗██╔════╝
██████╔╝██║   ██║██║   ██║███████╗
██╔══██╗██║   ██║██║   ██║╚════██║
██║  ██║╚██████╔╝╚██████╔╝███████║
╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚══════╝
`;
export const ROOS_OUTLINE = ROOS.replace(/█/g, " ");
