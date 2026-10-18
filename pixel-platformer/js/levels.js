// Original SKYLARK tile maps. Each string is a row, 16 px per cell.
const EMPTY = '.';
function level(name, width, paint) {
  const cells = Array.from({length:9}, () => Array(width).fill(EMPTY));
  for (let x=0;x<width;x++) { cells[7][x]='#'; cells[8][x]='#'; }
  const put = (x,y,ch) => {
    if(x>=0&&x<width&&y>=0&&y<9) cells[y][x]=ch;
  };
  const line = (x,y,count,ch) => {
    for(let dx=0;dx<count;dx++)put(x+dx,y,ch);
  };
  paint({put,line});
  return {name,rows:cells.map(row=>row.join(''))};
}

export const LEVELS = [
  level('Lantern Meadow', 52, ({put,line}) => {
    put(2,6,'S');
    put(47,6,'F');
    for(const x of [7,12,17,24,31,39,45]) put(x,5,'C');
    for(const x of [15,30,41]) put(x,3,'?');
    line(26,3,3,'B');
  }),
  level('Clockwork Crossing', 62, ({put,line}) => {
    put(2,6,'S');
    put(58,6,'F');
    for(const x of [10,20,31,43,52]) put(x,5,'C');
    for(const x of [16,29,41])put(x,3,'?');
    put(23,6,'e');
    put(37,6,'m');
    line(45,4,5,'=');
    for(const x of [33,34,52]){put(x,7,'.');put(x,8,'.');}
    put(47,6,'^');
  }),
  level('The Last Beacon', 74, ({put,line}) => {
    put(2,6,'S');
    put(70,6,'F');
    for(const x of [9,15,22,30,42,55,64])put(x,5,'C');
    for(const x of [13,28,46,61])put(x,3,'?');
    put(20,6,'e');
    put(38,6,'r');
    put(58,6,'m');
    line(48,4,4,'=');
    for(const x of [25,26,49,50,51]){put(x,7,'.');put(x,8,'.');}
    put(43,6,'^');put(64,6,'^');
  })
];
