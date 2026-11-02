export const levels=[
{name:'أول برنامج',map:['...G','*...','....','R...'],limit:8},
{name:'تجاوز الجدار',map:['..*G','.##.','....','R#..'],limit:9},
{name:'البطارية أولاً',map:['G..*','.##.','...#','R...'],limit:12},
{name:'بطاريتان',map:['...G','.#.#','*#*.','R...'],limit:12},
{name:'رحلة العودة',map:['G#.*','.#..','.#*.','R...'],limit:18},
{name:'الممر الواسع',map:['G...*','.###.','.*...','.##.#','R....'],limit:17},
{name:'خطة ملتوية',map:['..#G','*#..','..#*','R...'],limit:15},
{name:'المهمة الأخيرة',map:['G#..*','.#.#.','...#*','.###.','R....'],limit:21}
];
export const directions={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
export function startPuzzle(level){let x=0,y=0;level.map.forEach((r,j)=>{if(r.includes('R')){x=r.indexOf('R');y=j}});return {x,y,collected:[],failed:false,won:false}}
export function stepPuzzle(level,state,command){if(state.failed||state.won)return state;if(!directions[command])throw Error('Invalid command');const [dx,dy]=directions[command],x=state.x+dx,y=state.y+dy,cell=level.map[y]?.[x];if(!cell||cell==='#')return {...state,failed:true};const collected=[...state.collected],key=x+','+y;if(cell==='*'&&!collected.includes(key))collected.push(key);const total=level.map.join('').split('*').length-1;return {x,y,collected,failed:false,won:cell==='G'&&collected.length===total}}
