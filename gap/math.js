(function(root){
  function parsePace(value){const m=/^(\d{1,3}):([0-5]\d)$/.exec(value.trim());if(!m)return null;const s=Number(m[1])*60+Number(m[2]);return s>0?s:null;}
  function cost(grade){const i=grade/100;return 155.4*i**5-30.4*i**4-43.3*i**3+46.3*i**2+19.5*i+3.6;}
  // Exponent 0.83 confirmed in the Runalyze calculator code supplied by the user.
  function gap(seconds,grade){if(!Number.isFinite(seconds)||seconds<=0||!Number.isFinite(grade)||Math.abs(grade)>45)throw new RangeError('Invalid pace or grade');return seconds*Math.pow(3.6/cost(grade),0.83);}
  function format(seconds){const s=Math.round(seconds);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
  const api={parsePace,cost,gap,format};if(typeof module!=='undefined')module.exports=api;else root.PaceMath=api;
})(globalThis);
