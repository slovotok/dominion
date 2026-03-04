const today = new Date().toISOString().split("T")[0];
document.getElementById("date").innerText = today;

let data = JSON.parse(localStorage.getItem("dominion")) || {};

const inputs = document.querySelectorAll("input");
inputs.forEach(input => {
  input.addEventListener("input", calculateScore);
});

function calculateScore(){
  let values = Array.from(inputs).map(i => Number(i.value) || 0);
  let avg = values.reduce((a,b)=>a+b,0)/values.length;
  document.getElementById("score").innerText = avg.toFixed(1) + "%";
  return avg;
}

function saveDay(){
  const score = calculateScore();
  data[today] = score;
  localStorage.setItem("dominion", JSON.stringify(data));
  drawChart();
  alert("Zapisano.");
}

function drawChart(){
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  canvas.width = canvas.offsetWidth;
  canvas.height = 200;

  ctx.clearRect(0,0,canvas.width,canvas.height);

  const last7 = Object.values(data).slice(-7);
  const max = 100;

  last7.forEach((val,i)=>{
    const x = (canvas.width/7)*i + 20;
    const y = canvas.height - (val/max)*canvas.height;
    ctx.fillRect(x,y,20,canvas.height-y);
  });
}

function exportData(){
  const blob = new Blob([JSON.stringify(data)],{type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "dominion_backup.json";
  a.click();
}

drawChart();