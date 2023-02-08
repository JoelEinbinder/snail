
var scale = 1.0;
var full = false;
resize();
function resize(){
	var scalex = 1.0;
	var scaley = 1.0;
	scalex = $(window).width()/800;
	scaley = $(window).height()/600;
	if (scalex > scaley)
	{
		scale = scaley;
	}
	else
	{
		scale = scalex;
	}
	if (scale > 1 && !full)
	{
		scale = 1;
	}
	var sidebar = 0;
	$('#all').width($(window).width() - sidebar);
	$('#screen').width(800*scale);
	$('#screen').height(Math.round(600*scale));
	$('#screen').attr("width", 800*scale);
	$('#screen').attr("height", Math.round(600*scale));
	$('#screen').css("left",-scale*800/2 + "px");
	if (full && scalex > scaley){
		$('#screen').css('top',0);

	}
	else{
		$('#screen').css("top",$(window).height()/2-scale*600/2 + "px");
	}
}
$(window).resize(function(){
resize();
});
var fire1 = new Image();
fire1.src = "fire1.png";
var fire2 = new Image();
fire2.src = "fire2.png";
var fire3 = new Image();
fire3.src = "fire3.png";
var switch1 = new Image();
switch1.src = "switch1.png";
var switch2 = new Image();
switch2.src = "switch2.png";
var pauseWhite = new Image();
pauseWhite.src = "pausewhite.png";
var pauseBlack = new Image();
pauseBlack.src = "pauseblack.png";
//var treasure = new Image();
//treasure.src = "treasure.png";
//var treasurefull = new Image();
//treasurefull.src = "treasurefull.png";
var fade =1;
var ending = "wav";
var sound = [];
/*sound.push(new Audio("gravity_level1_track1." + ending));
sound.push(new Audio("gravity_level1_track2." + ending));
sound.push(new Audio("gravity_level1_track3." + ending));*/
var check = false;
var fadecolor = "rgba(0,0,0,";
var x = 0;
var y = 0;
var blockx = 50;
var blocky = 250;
var blockheight = 100;
var blockwidth = 400;
var xspeed = 0;
var yspeed = 0;
var rightDown = false;
var leftDown = false;
var upDown = false;
var downDown = false;
var block = new Array();
var part = new Array();
var set = "partOne";
var topblock = 0;
var rotate = false;
var grappleon = false;
var angle = 0;
var w = .01;
var paused = false;
var d = 50;
var grapplex =100;
var grappley =300;
var friction = .91;
var jump = 15;
var gravity = 1;
var view = 0;
var viewy = 0;
var toppart = 0;
var onice = false;
var d = new Date();
var deltatime = d.getTime();
var fps = 0;
var avgfps = 0;
var fpscount = 0;
var topstar;
var topcstar;
var star = new Array();
var cstar = new Array();
var buttononoff = false;
var ingame = true;
var cB = createBlock;
var cW = createWin;
var cK = createKill;
var cGr = createGrapple;
var cG = createGradient;
var cBG = createBGradient;
var cBn = createBounce;
var cI = createIce;
var cBx = createBox;
var cCv = createConveyor;
var cBCv = createBConveyor;
var text = [];
var box = [];
var botspeed = 0;
var besttime = "";
var starttime =  (new Date()).getTime();
var leanleft = false;
var leanright = false;
var gravoff = false;
var switchx = false;
var switchy = false;
var toucing = false;
var greenx = false;
var greeny = false;
var greenxspeed = 0;
var greenyspeed = 0;
var menuColor = "rgb(255,0,0)";
var ag1 = "rgb(255,255,255)";
var ag2 = "rgb(0,0,0)";
var lastgreenx = 0;
var lastgreeny = 0;
var startx = 0;
var starty = 0;
var lastlevel = false;
var verycheat = false;
var initfinal = true;
var initfinal2 = true;
var treasurex = 500;
var treasurey = 250;
var movefred = false;
var upHere = false;
var downHere = false;
var cLight = 0;
var lastblock = 0;
function Box(){
	this.x = 0;
	this.y = 0;
	this.width = 32;
	this.height = 32;
	this.xspeed = 0;
	this.yspeed = 0;
	this.fire = -1;
}
var fire = false;
var level = -1;
if (!localStorage){
	localStorage = {};
}
if (!localStorage.partOne){
	localStorage.partOne = 0;
}
if (!localStorage.partTwo){
	localStorage.partTwo = 0;
}
if (!localStorage.partThree){
	localStorage.partThree = 0;
}
if (!localStorage.partFour){
	localStorage.partFour = 0;
}

ingame = false;
var selecting = false;

var ctx = document.getElementById('screen').getContext('2d');
l[level]();
startx = x;
starty = y;
lastgreenx = greenx;
lastgreeny = greeny;
var oldbox = (JSON.stringify(box));

function Star(){
	this.x = 0;
	this.y = 0;
	this.on = false;
}
function CStar(){
	this.x = 0;
	this.y = 0;
	this.xspeed = 0;
	this.yspeed = 0;
	this.destx = 0;
	this.desty = 0;
	this.on = false;
}
function Block()
{
	this.x = 0;
	this.y = 0;
	this.width = 0;
	this.height = 0;
	this.kill = false;
	this.grapple = false;
	this.bounce = false;
	this.move = false;
	this.ice = false;
	this.dir = false;
	this.win = false;
	this.count = 50;
	this.gradient = false;
	this.max = 100;
	this.buttonmode = 0;
}
function Part()
{
	this.style = "";
	this.x = 0;
	this.y = 0;
	this.on = false;
}
function onKeyDown(evt) {
	if (ingame)
	{
		if (evt.keyCode == 39  || evt.keyCode == 68) rightDown = true;
		if (evt.keyCode == 37  || evt.keyCode == 65) leftDown = true;
		if (evt.keyCode == 38 || evt.keyCode == 87) upDown = true;
		if (evt.keyCode == 40 || evt.keyCode == 83) downDown = true;
		/*if (evt.keyCode == 32){
			if (!check){
				check = {};
				check.box = JSON.stringify(box);
				check.count = [];
				check.dir = [];
				check.mx = [];
				check.my = [];
				for (var i = 0; i < block.length; i++){
					if (block[i].move){
						if (i > lastblock){
							if (block[i].dir)
							{
								block[i].y += 2;
								block[i].count -=2;
								if (block[i].count <= 0)
								{
									block[i].dir = !block[i].dir;
								}
							}
							else
							{
								block[i].y -=2;
								block[i].count +=2;
								if (block[i].count >= block[i].max)
								{
									block[i].dir = !block[i].dir;
								}
							}
						}
						check.count[i] = block[i].count;
						check.dir[i] = block[i].dir;
						check.mx[i] = block[i].x;
						check.my[i] = block[i].y;
					}
				}
				check.x = x;
				check.y = y;
				check.xspeed = xspeed;
				check.yspeed = yspeed;
				check.cLight = cLight;
			}
		}*/
		if (evt.keyCode == 82){
			check = false;
			kill();
		}
	}
	if (evt.keyCode == 27 || evt.keyCode == 32){
		paused = !paused;
	}
	if (evt.keyCode == 88 && evt.shiftKey && evt.ctrlKey){
		ctx.shadowColor = "rgb(0,0,0)";
		ctx.shadowBlur = 10;
	}
}
//and unset them when the right or left key is released
function onKeyUp(evt) {
	if (ingame)
	{
		if (evt.keyCode == 39  || evt.keyCode == 68) rightDown = false;
		if (evt.keyCode == 37  || evt.keyCode == 65) leftDown = false;
		if (evt.keyCode == 38 || evt.keyCode == 87) upDown = false;
		if (evt.keyCode == 40 || evt.keyCode == 83) downDown = false;
	}
}
//touches
function handleTouch(e){
 leftDown = false;
 rightDown = false;
 upDown = false;
 downDown = false;
 for (var i = 0; i < e.targetTouches.length; i++)
 {
	if (e.targetTouches[i].pageX < $(document).width()/3)
	{
		leftDown = true;
	}
	else
	{
		if (e.targetTouches[i].pageX > 2*$(document).width()/3)
		{rightDown = true;}
		else
		{
			upDown = true;
		}
	}
 }
}
 document.addEventListener("touchstart", handleTouch, false);
 document.addEventListener("touchmove", handleTouch, false);
 document.addEventListener("touchend", handleTouch, false);
 document.addEventListener("touchcancel", handleTouch, false);
 document.addEventListener("touchleave", handleTouch, false);
function onTopDown(evt) {
	evt.preventDefault();

	var mx = evt.pageX - $('#screen').offset().left;
	var my = evt.pageY - $('#screen').offset().top;
	mx = mx/scale;
	my = my/scale;
	if (paused){
		if (my > 300){
			menu();
		}
		paused =false;

		return;
	}
	if (mx > 800-32-6 && mx < 800-6 && my > 6 && my < 6+32){
		paused = true;
		downHere =false;
		upHere =false;
		return;
	}
	if (level == -1)
	{
		for (var i in block){
			if (block[i].kill || block[i].ice || block[i].bounce || block[i].win){
				if (block[i].x < mx && block[i].x + block[i].width > mx && block[i].y < my && block[i].y + block[i].height > my){
					topblock=0;
					x=0;
					y=0;
					xspeed=0;
					yspeed=0;
					rightDown = false;
					leftDown = false;
					upDown = false;
					downDown = false;
					var type = "unknown";
					if (block[i].ice){
						//level = 0;
						type = "ice";
						set = "partOne";
						fadecolor = "rgba(0,255,255,";
						menuColor = "rgb(0,255,255)";
					}
					if (block[i].kill){
						//level = 20;
						type = "kill";
						set = "partTwo";
						fadecolor = "rgba(255,0,0,";
						menuColor = "rgb(255,0,0)";
					}
					if (block[i].bounce){
						//level = 40;
						type = "bounce";
						set = "partThree";
						fadecolor = "rgba(0,255,0,";
						menuColor = "rgb(0,255,0)";
					}
					if (block[i].win){
						//level = 40;
						type = "win";
						set = "partFour";
						fadecolor = "rgba(255,255,0,";
						menuColor = "rgb(255,255,0)";
					}
					fade = 1;
					//console.log('woo');
					if (selecting){
						if (block[i].ice){
							level = 0;
							fadecolor = "rgba(0,255,255,";
						}
						if (block[i].kill){
							level = 20;
							fadecolor = "rgba(255,0,0,";
						}
						if (block[i].bounce){
							level = 40;
							fadecolor = "rgba(0,255,0,";
						}
						if (block[i].win){
							level = 60;
							fadecolor = "rgba(255,255,0,";
						}
						//console.log(level);
						level+= Math.floor((block[i].x-160)/96);
						level+= 5*Math.floor((block[i].y-128)/96);
						//console.log(level);
						ingame = true;
						block = [];
						box = [];
						l[level]();
						selecting =false;
						//console.log(level);
					}
					else{
						selecting = true;
						block = [];
						box = [];
						levelselect();
						var max = Number(localStorage[set]);
						for (var i in block){
							if (block[i].ice){
								if(Math.floor((block[i].x-160)/96) + 5*Math.floor((block[i].y-128)/96) > max){
									block[i].x += 1000;
								}
								block[i].ice = false;
								block[i][type] = true;
							}
						}
					}
					startx = x;
					starty = y;
					oldbox = (JSON.stringify(box));
					return;
				}
			}
		}
		for (var i in box){
			if (box[i].x < mx && box[i].x + box[i].width > mx && box[i].y < my && box[i].y + box[i].height > my){
				topblock=0;
				x=0;
				y=0;
				xspeed=0;
				yspeed=0;
				rightDown = false;
				leftDown = false;
				upDown = false;
				downDown = false;
				level=80;
				set = "partFive";
				fadecolor = "rgba(128,128,128,";
				fade = 1;
				box = [];
				block = [];
				ingame = true;
				l[level]();
				startx = x;
				starty = y;
				oldbox = (JSON.stringify(box));
				return;
			}
		}
		if (mx > 800-32-6 && mx < 800-6 && my > 6 && my < 6+32){
			paused = true;
		}

	}

}
$(document).keydown(onKeyDown);
$(document).keyup(onKeyUp);
$('#screen').mousedown(onTopDown);
$('#screen').mousemove(function(e){
	var mx = e.pageX - $('#screen').offset().left;
	var my = e.pageY - $('#screen').offset().top;
	mx = mx/scale;
	my = my/scale;
	//console.log(mx);
	setCursor("default");
	if (paused){
		setCursor("pointer");
		if (my < 300){
			upHere = true;
			downHere = false;
		}
		else{
			upHere = false;
			downHere =true;
		}
	}
	if (mx > 800-32-6 && mx < 800-6 && my > 6 && my < 6+32){
		setCursor("pointer");
	}
	if (level == -1){
		for (var i in block){
			if (block[i].kill || block[i].ice || block[i].bounce || block[i].win){
				if (block[i].x < mx && block[i].x + block[i].width > mx && block[i].y < my && block[i].y + block[i].height > my){
					setCursor("pointer");
				}
			}
		}
		for (var i in box){
			if (box[i].x < mx && box[i].x + box[i].width > mx && box[i].y < my && box[i].y + box[i].height > my){
				setCursor("pointer");
			}
		}

	}
});
var ox1 = 200;
setInterval(step,33);
//setInterval(draw,33);
function step(){
	if (paused){
		draw();
		ctx.fillStyle = "rgba(0,0,0,.95)";
		ctx.fillRect(0,0,800*scale,600*scale);

		ctx.font= 25*scale + "pt Sans-Serif";

		ctx.shadowColor = "rgb(0,0,255)";
		ctx.fillStyle = "rgb(255,255,255)";
		if (upHere){
			ctx.shadowOffsetX = 5;
			ctx.shadowOffsetY = 5;
			ctx.shadowBlur = 5;
		}
		ctx.fillText("Click up here to resume the game.",200*scale-41*scale,200*scale);
		if (downHere){

			ctx.shadowOffsetX = 5;
			ctx.shadowOffsetY = 5;
			ctx.shadowBlur = 5;
		}
		else{
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			ctx.shadowBlur = 0;
		}
		ctx.fillText("Click down here for the main menu.",200*scale-49*scale,400*scale);
		ctx.shadowBlur = 0;
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;


		ctx.fillStyle = "rgb(255,255,255)";

		ctx.font = 14*scale + "pt Sans-Serif";
		ctx.fillText("Game by Joel Einbinder, Dennis Bradford, and Justin Forman",275*scale,595*scale);


		ctx.font = 8*scale+"pt Sans-Serif";
		var i= 0;
		ctx.fillText("Special thanks:",5*scale,15*scale+i*scale);

		return;
	}
	if (lastlevel && initfinal)
	{
		initfinal = false;
		setTimeout(function(){
			text[0].txt = "";
		},4000);
		setTimeout(function(){
			greenx = -32;greeny = 210;
			lastgreenx = -32;lastgreeny = 210;
		},5000);
	}
	cLight += 10;
	if (cLight > 300){
		cLight -= 300;
	}
	var grav = true;
	d = new Date();
	fps += 1000/(d.getTime() - deltatime);
	fpscount ++;
	if (fpscount == 10)
	{
		avgfps = fps/10;
		fps = 0;
		fpscount = 0;
	}
	deltatime = d.getTime();
	draw();
	var lastleft = leanleft;
	var lastright = leanright;
	leanleft = false;
	leanright = false;
	var sidebox = 0;
	lastx = x;
	lasty = y;
	lastxspeed = xspeed;
	if (!ingame)
	{
		if (rightDown)
		{
			if (x > 590)
			{
				upDown = true;
				//leftDown = true;
				//rightDown = false;
			}
			if (x > 640)
			{
				rightDown = false;
			}

		}
		else
		{
			if (x > 640)
			{
				if (y < 300)
				{
					leftDown = true;
					upDown = false;
				}
			}
		}
		if (leftDown)
		{
			if (x < 150)
			{
				upDown = true;
				//leftDown = false;
				//rightDown = true;
			}
			if (x < 100)
			{
				leftDown = false;
			}
		}
		else
		{
			if (x < 100)
			{
				if (y > 300)
				{
					rightDown = true;
					upDown = false;
				}
			}
		}
	}
	if (!rotate)
	{
		if (rightDown)
		{
			xspeed += 1;
		}
		if (leftDown)
		{
			xspeed -= 1;
		}
		if (!lastlevel || greenx < 400 || greenx > 500)
		{
			greenxspeed += 1;
		}
		else
		{
			if (lastlevel)
			{
				if (initfinal2)
				{
					initfinal2 = false;

					setTimeout(function(){
					greenyspeed = -6;
					text[0].txt = "WHAT!?";},250);
					setTimeout(function(){
						text[1] = {};
						text[1].color = 1;
						text[1].txt = "Where did the treasure go?!";
						text[1].x = 100;
						text[1].y = text[0].y + 40;
					},900);

					setTimeout(function(){
						text[0].txt = "This is impossible.";
						text[1].txt = "";
					},2600);
					setTimeout(function(){
						text[0].txt = "This is impossible.";
						text[1].txt = "I will kill whoever is responsible!";
					},3600);
					setTimeout(function(){
						greenxspeed = 10;
					},4100);
					setTimeout(function(){
						text = [];
					},8000);
					setTimeout(function(){
						var fred = box.length;
						cBx(750,700,32,32);
						box[fred].fire = 0;
						movefred = true;
					},12000);
				}
			}
		}
		if (!onice)
		{
			if ((Math.abs(xspeed)-Math.abs(botspeed)) * (1-friction) > 1)
			{
				if (xspeed > 0)
				{
					xspeed -= 1;
				}
				else
				{
					xspeed += 1;
				}
			}
			else
			{
				if (botspeed != 0)
				{
					//console.log(botspeed);
				}
				xspeed = (xspeed-botspeed)*friction+botspeed;
			}
			if (Math.abs(greenxspeed) * (1-friction) > 1)
			{
				if (greenxspeed > 0)
				{
					greenxspeed -= 1;
				}
				else
				{
					greenxspeed += 1;
				}
			}
			else
			{
				if (botspeed != 0)
				{
					//console.log(botspeed);
				}
				greenxspeed = (greenxspeed)*friction;
			}
		}
		botspeed = 0;
		y+=yspeed;
		greeny+=greenyspeed;

	}
	else
	{
		if (downDown)
		{
			rotate = false;
			angle = angle+Math.PI/2;
			xspeed = w * Math.cos(angle) * d;
			yspeed = w * Math.sin(angle) * d;
		}
		else
		{
			//rotation code
			angle+=w;
			y = y + d*Math.sin(angle)-16;
		}
	}
	onice = false;
	for (var i = 0; i < topblock; i++)
	{
		if (block[i].move)
		{
			if (block[i].dir)
			{
				block[i].y += 2;
				block[i].count -=2;
				if (block[i].count <= 0)
				{
					block[i].dir = !block[i].dir;
				}
			}
			else
			{
				block[i].y -=2;
				block[i].count +=2;
				if (block[i].count >= block[i].max)
				{
					block[i].dir = !block[i].dir;
				}
			}
			lastblock = i;
		}

		if (x+32 > block[i].x)
		{

			if (block[i].gradient)
			{
				if (block[i].x+block[i].width > x)
				{
					if (block[i].y <= y+16 && block[i].y+block[i].height >= y+16)
					{
						//yspeed+=10*block[i].height/(y-block[i].height-block[i].y);
						//yspeed -= (y-block[i].y)*(y-block[i].y)/100;
						if (y +16 > 300)
						{
							if (block[i].b)
							{
								yspeed -= 1;
								grav = false;
							}
							else
							{
								yspeed += 1;
								grav = false;
							}
						}
						else
						{
							if (block[i].b)
							{
								yspeed += 1;
								grav = false;
							}
							else
							{
								yspeed -= 1;
								grav = false;
							}
						}
					}
				}
			}
			if(y+32>=block[i].y)
			{
				if (block[i].x+block[i].width > x)
				{
					if (block[i].y+block[i].height >= y)
					{
						if (block[i].grapple || block[i].gradient)
						{
							if (block[i].grapple)
							{
								grappleon = true;
							}
							else
							{

							}
						}
						else
						{
							if (block[i].kill)
							{
								if (!verycheat)
								{
									if (circleCollide(block[i])){
										kill();
										return;
									}
								}
							}
							else
							{
								if (!rotate)
								{

									if 	(block[i].ice)
									{
										onice = true;
									}

									if (block[i].win)
									{
										win();
										return;
									}
									if (block[i].conveyor){
										if (block[i].bc){
											botspeed = -12;
										}
										else{
											botspeed = 12;
										}
									}
									//yspeed = 0;
									if (lasty < block[i].y)
									{
										if (block[i].bounce)
										{
											yspeed = -yspeed;
											y+=yspeed;
										}
										else
										{
											y = block[i].y - 32;
											if (block[i].x < x)
											{
												leanright = true;
												sidebox = i;
											}
											if (block[i].x +block[i].width > x + 32)
											{
												leanleft = true;
												sidebox = i;
											}
											if (yspeed > 0)
											{
												yspeed = 0;
											}
											if (upDown || downDown)
											{
												yspeed = -jump;
											}
										}
									}
									else
									{

										if (block[i].bounce)
										{
											yspeed = -yspeed;
											y+=yspeed;
										}
										else
										{
										y = block[i].y+block[i].height;
											if (block[i].x < x)
											{
												leanright = true;
												sidebox = i;
											}
											if (block[i].x +block[i].width > x + 32)
											{
												leanleft = true;
												sidebox = i;
											}
											if (yspeed < 0)
											{
												yspeed = 0;
											}
											if (upDown || downDown)
											{
												yspeed = jump;
											}
										}
									}
								}
								else
								{
									angle -=w;
									y = grappley + d*Math.sin(angle)-16;
									w = 0;
								}
							}
						}
					}
				}
			}
		}
	}
	//green vertical
	if (greenx)
	{

		for (var i = 0; i < topblock; i++)
		{
			if (greenx+32 > block[i].x)
			{
				if(greeny+32>=block[i].y)
				{
					if (block[i].x+block[i].width > greenx)
					{
						if (block[i].y+block[i].height >= greeny)
						{
							if (block[i].grapple || block[i].gradient)
							{
							}
							else
							{
								if (block[i].kill)
								{
									greenx =false;
								}
								else
								{
									if (!rotate)
									{

										if (block[i].win)
										{
											greenx = false;
											return;
										}
										//yspeed = 0;
										if (greeny < block[i].y)
										{
											if (block[i].bounce)
											{
												greenyspeed = -greenyspeed;
												greeny+=greenyspeed;
											}
											else
											{
												greeny = block[i].y - 32;
												if (greenyspeed > 0)
												{
													greenyspeed = 0;
												}
											}
										}
										else
										{

											if (block[i].bounce)
											{
												greenyspeed = -greenyspeed;
												greeny+=greenyspeed;
											}
											else
											{
												greeny = block[i].y+block[i].height;
												if (greenyspeed < 0)
												{
													greenyspeed = 0;
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}
	//check if we need to move fred;
	if (movefred)
	{
		if (box[1].y < 300)
		{
			box[1].xspeed -=.4;
		}
		if (box[1].x < 96)
		{
			box[1].yspeed = -10;
		}
	}
	//check boxes for vertical collision
	for (var i = 0; i < box.length; i++)
	{
		box[i].onice = false;
		box[i].botspeed = 0;
		box[i].botcount = 0;
		box[i].lasty = box[i].y;
		box[i].y+=box[i].yspeed;
		//check for block collisions
		for (var b = 0; b < topblock;b++)
		{
			if (!block[b].kill)
			{
				if (block[b].x+block[b].width > box[i].x)
				{
					if (box[i].x+box[i].width > block[b].x)
					{
						if (block[b].y+block[b].height >= box[i].y)
						{
							if (box[i].y + box[i].height >= block[b].y)
							{
								if (block[b].win)
								{
									if (movefred)
									{

										win();

									}
								}
								if (box[i].lasty < block[b].y)
								{

									if (block[b].bounce)
									{
										box[i].yspeed*=-1;
										box[i].y += box[i].yspeed;
									}
									else
									{
										box[i].y = block[b].y - box[i].height;

										if (box[i].yspeed > 0)
										{
											box[i].yspeed = 0;
										}
									}
									if (block[b].ice)
									{
										box[i].onice = true;
									}
									if (block[b].conveyor)
									{
										if (block[b].bc){
											box[i].botcount --;
										}
										else{
											box[i].botcount ++;
										}
									}
								}
								else
								{
									if (block[b].bounce)
									{
										box[i].yspeed*=-1;
										box[i].y += box[i].yspeed;
									}
									else
									{
										box[i].y = block[b].y+block[b].height;
										if (box[i].yspeed < 0)
										{
											box[i].yspeed = 0;
										}
									}
									if (block[b].ice)
									{
										box[i].onice = true;
									}
									if (block[b].conveyor)
									{
										if (block[b].bc){
											box[i].botcount --;
										}
										else{
											box[i].botcount ++;
										}
									}
								}
							}
						}
					}
				}
			}
		}
		//check for collisions with other boxes
		for (var b = 0; b < box.length; b++)
		{
			if (i != b)
			{
			if (box[i].x + box[i].width > box[b].x)
			{
				if (box[b].x+box[b].width > box[i].x)
				{
					if (box[i].y+box[i].height > box[b].y)
					{
						if (box[b].y + box[b].height > box[i].y)
						{
							if (box[i].lasty < box[b].lasty)
							{
								box[i].y = box[b].y -box[i].height;
								if (box[i].yspeed > box[b].yspeed)
								{
									box[i].yspeed = box[b].yspeed;
								}
							}
							else
							{
								box[i].y = box[b].y + box[b].height;
								if (box[i].yspeed < box[b].yspeed)
								{
									box[i].yspeed = box[b].yspeed;
								}

							}

						}
					}
				}
			}
			}
		}
		if (x+32 > box[i].x)
		{
			if (box[i].x+box[i].width > x)
			{
				if (y+32 >= box[i].y)
				{
					if (box[i].y + box[i].height >= y)
					{
						if (lasty < box[i].lasty)
						{
							y = box[i].y - 32;
							botspeed += box[i].xspeed;
							if (yspeed > box[i].yspeed)
							{
								yspeed = box[i].yspeed;
							}
							if (upDown || downDown)
							{
								yspeed =-jump;
							}

						}
						else
						{

							y = box[i].y+box[i].height;
							botspeed += box[i].xspeed;
							if (yspeed < box[i].yspeed)
							{
								yspeed = box[i].yspeed;
							}
							if (upDown || downDown)
							{
								yspeed = jump;
							}
						}
					}
				}
			}
		}
		if (box[i].y+box[i].height/2<300 || gravoff)
		{
			box[i].yspeed+=gravity;
		}
		else
		{
			box[i].yspeed-=gravity;
		}
	}

	//final check
	for (var i = 0; i<topblock; i++)
	{
		if (x+32 > block[i].x)
		{
			if(y+32>block[i].y)
			{
				if (block[i].x+block[i].width > x)
				{
					if (block[i].y+block[i].height > y)
					{
						if (!block[i].win && !block[i].bounce && !block[i].gradient){
							kill();
										return;
						}
					}
				}
			}
		}
	}
	if (rotate)
	{
		x = grapplex + d*Math.cos(angle)-16;
	}
	else
	{
		x+=xspeed;
		if (greenx)
		{
			greenx+=greenxspeed;
		}
	}
	if (fire)
	{
		if (x > fire && box[0].fire < 0)
		{
			box[0].fire = 0;
		}
	}
	if (x < 0)
	{
		x= 0;
		xspeed = 0;
	}
	if (greenx)
	{
		if (greenx < 0)
		{
//			greenx= 0;
//			greenxspeed = 0;
		}
	}
	for (var i = 0; i<topblock; i++)
	{
		if (x+32 > block[i].x)
		{
			if(y+32>block[i].y)
			{
				if (block[i].x+block[i].width > x)
				{
					if (block[i].y+block[i].height > y)
					{
						if (block[i].grapple || block[i].gradient)
						{
							if (block[i].grapple)
							{
								grappleon = true;
							}
						}
						else
						{
							if (block[i].kill)
							{
								if (!verycheat)
								{
									if (circleCollide(block[i])){
										kill();
										return;
									}
								}
							}
							else
							{

									if (block[i].win)
									{

										win();
										return;
									}
								if (!rotate)
								{
									if (lastx < block[i].x)
									{
										x = block[i].x - 32;
									}
									else
									{
										x = block[i].x+block[i].width;
									}
									if (block[i].bounce)
									{
										xspeed = -xspeed;
									}
									else
									{
										xspeed = 0;
									}
								}
								else
								{
									angle -=w;
									x = grapplex + d*Math.cos(angle)-16;
									w = 0;
								}
							}
						}
					}
				}
			}
		}
	}
	//green horizontal
	if (greenx)
	{
		for (var i = 0; i<topblock; i++)
		{
			if (greenx+32 > block[i].x)
			{
				if(greeny+32>block[i].y)
				{
					if (block[i].x+block[i].width > greenx)
					{
						if (block[i].y+block[i].height > greeny)
						{
							if (block[i].grapple || block[i].gradient)
							{
								if (block[i].grapple)
								{
									grappleon = true;
								}
							}
							else
							{
								if (block[i].kill)
								{
									greenx = false;
								}
								else
								{

										if (block[i].win)
										{

											greenx = false;
											return;
										}
									if (!rotate)
									{
										if (greenx < block[i].x)
										{
											greenx = block[i].x - 32;
										}
										else
										{
											greenx = block[i].x+block[i].width;
										}
										if (block[i].bounce)
										{
											greenxspeed = -greenxspeed;
										}
										else
										{
											greenxspeed = 0;
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}
	//check box for horizontal collision
	for (var i = 0; i < box.length; i++)
	{
		box[i].lastx = box[i].x;
		box[i].x+=box[i].xspeed;
		if (!box[i].onice)
		{
			if (box[i].botcount > 0){
				box[i].botspeed = 5;
			}
			if (box[i].botcount < 0){
				box[i].botspeed -= 5;
			}

			box[i].xspeed = (box[i].xspeed-box[i].botspeed)*friction+box[i].botspeed;
		}
		if (x+32 > box[i].x)
		{
			if (box[i].x+box[i].width > x)
			{
				if (y+32 > box[i].y)
				{
					if (box[i].y + box[i].height > y)
					{
						var lastboxx = box[i].x;
						if (lastx < box[i].x)
						{
							box[i].x = x+32;
						}
						else
						{
							box[i].x = x-box[i].width;
						}
						box[i].xspeed =xspeed;
					}
				}
			}
		}

		//check for block collisions
		for (var b = 0; b < topblock;b++)
		{
			if (!block[b].kill)
			{
				if (block[b].x+block[b].width > box[i].x)
				{
					if (box[i].x+box[i].width > block[b].x)
					{
						if (block[b].y+block[b].height > box[i].y)
						{
							if (box[i].y + box[i].height > block[b].y)
							{
								if (box[i].lastx < block[b].x)
								{
									box[i].x = block[b].x - box[i].width;

									if (block[b].bounce)
									{
										box[i].xspeed*=-1;
									}
									else
									{
										if (box[i].xspeed > 0)
										{
											box[i].xspeed = 0;
										}
									}
									if (x+32 > box[i].x)
									{
										if (box[i].x+box[i].width > x)
										{
											if (y+32 > box[i].y)
											{
												if (box[i].y + box[i].height > y)
												{
													x = box[i].x-32;
													xspeed = 0;
												}
											}
										}
									}
								}
								else
								{
									box[i].x = block[b].x+block[b].width;
									if (block[b].bounce)
									{
										box[i].xspeed*=-1;
									}
									else
									{
										if (box[i].xspeed < 0)
										{
											box[i].xspeed = 0;
										}
									}
									if (x+32 > box[i].x)
									{
										if (box[i].x+box[i].width > x)
										{
											if (y+32 > box[i].y)
											{
												if (box[i].y + box[i].height > y)
												{
													x = box[i].x+box[i].width;
													xspeed = 0;
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}
	//check for lean jumping
	if (leanleft == !lastleft)
	{
		if (leanright == !lastright)
		{
			if (leanright != leanleft)
			{
				//we switched sides
				if (leanright)
				{
					if (lastxspeed < 0)
					{
						xspeed = 0;
						x = block[sidebox].x+block[sidebox].width;
					}
				}
				else
				{
					if (lastxspeed >  0)
					{
						xspeed = 0;
						x = block[sidebox].x-32;

					}
				}

			}
		}

	}
	//check for switch collision
	if (switchx)
	{
		if (switchx+64 > x)
		{
			if (x+32 > switchx)
			{
				if (switchy + 64 > y)
				{
					if (y+32 > switchy)
					{
						if (!touching)
						{
							gravoff = !gravoff;
							touching = true;
						}
					}
					else
					{
						touching = false;
					}
				}
				else
				{
					touching = false;
				}
			}
			else
			{
				touching = false;
			}
		}
		else
		{
			touching = false;
		}
	}
	if (greeny+16 < 300  || gravoff)
	{
		greenyspeed += gravity;
	}
	else
	{
		greenyspeed -= gravity;
	}
	if (y+16 < 300  || gravoff)
	{
		if (rotate)
		{
			w += Math.cos(angle)*gravity/d;
		}
		else
		{
			if (grav)
			{
				yspeed += gravity;
			}
		}
	}
	else
	{
		if (rotate)
		{
			w -= Math.cos(angle)*gravity/d;

		}
		else
		{
			if (grav)
			{
				yspeed -= gravity;
			}
		}
	}
}
function draw(){
	if (ingame)
	{
		if (x > 400)
		{
			view = 400-x;
		}
		else
		{
			view = 0;
		}
		if (y > 400)
		{
			viewy = 400-y;
		}
		else
		{
			if (y < 200)
			{
				viewy = 200-y;
			}
			else
			{
				viewy = 0;
			}
		}
	}
	view = Math.floor(view);
	viewy = Math.floor(viewy);
	if (!ingame)
	{
		view = 0;
		viewy = 0;
	}
	var grect = [];
	var agrect = [];
	if (ctx){

		ctx.fillStyle = "rgba(0,0,0,1)";
		ctx.fillRect((0)*scale,(0)*scale,(800)*scale,(600)*scale);
		if (!gravoff)
		{
		ctx.fillStyle = "white";
		ctx.fillRect((0)*scale,600*scale+(viewy-300)*scale,(800)*scale,-(viewy-300)*scale);
		}
		for (var i = 0; i <topblock; i++)
		{
			if (block[i].x < -view+800 && block[i].x + block[i].width > -view && block[i].y + block[i].height > -viewy)
			{
				var style = "";
				var a = 100/(1+Math.sqrt((x-block[i].x-block[i].width/2)*(x-block[i].x-block[i].width/2)+(y-block[i].y-block[i].height/2)*(y-block[i].y-block[i].height/2)));
								a -= 0;
				if (a < 0)
				{
					a = 0;
				}
				var aa = 1;
				if (aa>1)
				{
					aa = 1;
				}
				//var a = 100/(1+Math.sqrt(Math.pow(x-block[i].x-block[i].width/2,2)+Math.pow(y-block[i].y-block[i].height/2,2)));
				if (block[i].grapple)
				{
					ctx.strokeStyle = "rgba(0,255,0,"+aa+")";
					ctx.fillStyle = "rgba(0,255,0,"+a+")";
					style = "rgba(0,255,0,.5)";
				}
				else
				{
					if (block[i].kill)
					{
						ctx.strokeStyle = "rgba(255,0,0,"+aa+")";
						ctx.fillStyle = "rgba(255,0,0,"+a+")";
						style = "rgba(255,0,0,.5)";
					}
					else
					{
						if (block[i].ice)
						{
							ctx.strokeStyle = "rgba(0,255,255,"+aa+")";
							ctx.fillStyle = "rgba(0,255,255,"+a+")";
							style = "rgba(0,255,255,.5)";

						}
						else
						{
							if (block[i].win)
							{
								ctx.strokeStyle = "rgba(255,255,0,"+aa+")";
								ctx.fillStyle = "rgba(255,255,0,"+a+")";
								style = "rgba(255,255,0,.5)";
							}
							else
							{
								if (block[i].bounce)
								{
									ctx.strokeStyle = "rgba(0,255,0,"+aa+")";
									ctx.fillStyle = "rgba(0,255,0,"+a+")";
									style = "rgba(0,255,0,.5)";
								}
								else
								{
									if (block[i].conveyor)
									{
										if (block[i].bc){
											var b = calcBB(block[i].x);
											ctx.strokeStyle = "rgba(255,128,0,"+aa+")";
											ctx.fillStyle = "rgba(255,128,0,"+b+")";
											style = "rgba(255,128,0,.5)";
										}
										else{
											var b = calcB(block[i].x);
											ctx.strokeStyle = "rgba(128,0,255,"+aa+")";
											ctx.fillStyle = "rgba(128,0,255,"+b+")";
											style = "rgba(128,0,255,.5)";
										}
									}
									else
									{
										ctx.strokeStyle = "rgba(128,128,128,"+aa+")";
										ctx.fillStyle = "rgba(128,128,128,"+a+")";
										style = "rgba(128,128,128,.5)";

									}

								}
							}
						}
					}
				}
				//var tmp = ctx.strokeStyle;
				//ctx.strokeStyle = ctx.fillStyle;
				//ctx.fillStyle = "rgba(0,0,0,0)";
				if (true)
				{
					if (block[i].gradient)
					{
						//var grad = ctx.createLinearGradient(block[i].x+view,block[i].y+viewy, block[i].x+view, block[i].y+viewy+block[i].height);
						ctx.fillStyle = ag1;
						if(block[i].y < 300)
						{
							if (300-block[i].y < block[i].height)
							{
								ctx.fillRect((block[i].x+view)*scale,(block[i].y+viewy)*scale, (block[i].width)*scale, (300-block[i].y)*scale);
								agrect.push({
									x:(block[i].x+view)*scale,
									y:(block[i].y+viewy)*scale,
									w:(block[i].width)*scale,
									h:(300-block[i].y)*scale
								});
								ctx.fillStyle = ag2;
								ctx.fillRect((block[i].x+view)*scale,(viewy+300)*scale, (block[i].width)*scale,(block[i].height-(300-block[i].y))*scale);
								grect.push({
									x:(block[i].x+view)*scale,
									y:(300+viewy)*scale,
									w:(block[i].width)*scale,
									h:(block[i].height-(300-block[i].y))*scale
								});
							}
							else
							{
								ctx.fillRect((block[i].x+view)*scale,(block[i].y+viewy)*scale, (block[i].width)*scale, (block[i].height)*scale);
								agrect.push({
									x:(block[i].x+view)*scale,
									y:(block[i].y+viewy)*scale,
									w:(block[i].width)*scale,
									h:(block[i].height)*scale
								});

							}
						}
						else
						{
							ctx.fillStyle = ag2;
							ctx.fillRect((block[i].x+view)*scale,(block[i].y+viewy)*scale,( block[i].width)*scale, (block[i].height)*scale);
							grect.push({
								x:(block[i].x+view)*scale,
								y:(block[i].y+viewy)*scale,
								w:(block[i].width)*scale,
								h:(block[i].height)*scale
							});
						}
					}
					else
					{
						ctx.lineWidth = (2)*scale;//2;
						ctx.strokeRect((block[i].x+view)*scale,(block[i].y+viewy)*scale,(block[i].width)*scale,(block[i].height)*scale);
						ctx.fillRect((block[i].x+view)*scale,(block[i].y+viewy)*scale,(block[i].width)*scale,(block[i].height)*scale);
					}
				}
							var max = block[i].width*block[i].height/1024;
				for (var b = 0; b < max; b++)
				{
					if (Math.random() > .95)
					{
						//createPart(Math.random()*block[i].width+block[i].x,Math.random()*block[i].height+block[i].y,style);
					}
				}
			}
			//createPart(Math.random()*block[i].width+block[i].x,Math.random()*block[i].height+block[i].y);
		}
		/*for (var i = 0; i < toppart; i++)
		{
			if (part[i].on)
			{
				ctx.fillStyle = part[i].style;
				if (part[i].x < -view || part[i].x > -view + 800 || part[i].y < -viewy || part[i].y > -viewy + 600 || Math.random() > .98)
				{
					part[i].on = false;
				}
				else
				{
					ctx.fillRect(part[i].x+view-13,part[i].y+viewy-13,26,26);
				}
			}
		}*/
		/*
		if (rotate)
		{
			ctx.beginPath();
			ctx.strokeStyle = "rgb(0,255,0)";
			ctx.lineWidth = 3;
			ctx.moveTo(x+16+view,y+16+viewy);
			ctx.lineTo(grapplex+view,grappley+viewy);
			ctx.stroke();
			ctx.fillStyle="rgb(0,255,0)";
			ctx.beginPath();
			ctx.arc(grapplex+view,grappley+viewy,4,0,Math.PI*2,true);
			ctx.closePath();
			ctx.fill();
		}*/
		if (switchx)
		{
			if (!gravoff)
			{
				ctx.drawImage(switch1,(switchx+view)*scale,(switchy+viewy)*scale,switch1.height*scale,switch1.width*scale);
			}
			else
			{
				ctx.drawImage(switch2,(switchx+view)*scale,(switchy+viewy)*scale,switch2.width*scale,switch2.height*scale);
			}
		}
		if (lastlevel)
		{

				ctx.drawImage(treasure,(treasurex+view)*scale,(treasurey+viewy)*scale,treasure.width*scale,treasure.height*scale);
		}
		if (check){
			if (check.y < 300-viewy){
				ctx.lineWidth = 4*scale;
				ctx.strokeStyle = "rgb(128,128,128)";
				ctx.beginPath();
				ctx.arc((check.x+view+16)*scale,(check.y+viewy+16)*scale,(15)*scale,0,Math.PI*2,true);
				ctx.stroke();
				ctx.beginPath();
				ctx.arc((check.x+view+16)*scale,(check.y+viewy+16)*scale,(5)*scale,0,Math.PI*2,true);
				ctx.stroke();

				ctx.fillStyle = "rgb(255,0,0)";
				ctx.lineWidth = (2)*scale;
			}
		}
		if (true)
		{
			drawTopPlayer(0,0,800*scale,300*scale);
			drawPause(0,0,800*scale,300*scale,false);
			drawBotPlayer(0,300*scale,800*scale,300*scale);
			drawPause(0,600*scale+(viewy-300)*scale,(800)*scale,-(viewy-300)*scale,true);

			//console.log(grect);
			for (var i in grect){
				drawTopPlayer(grect[i].x,grect[i].y,grect[i].w,grect[i].h);
				drawPause(grect[i].x,grect[i].y,grect[i].w,grect[i].h,false);
			}
			for (var i in agrect){
				drawBotPlayer(agrect[i].x,agrect[i].y,agrect[i].w,agrect[i].h);
				drawPause(agrect[i].x,agrect[i].y,agrect[i].w,agrect[i].h,true);
			}
		}
		if (greenx)
		{
			//if (greeny < 300)
			{
				if(lastlevel)
				{
					ctx.fillStyle = "rgb(0,0,100)";
				}
				else
				{
					ctx.fillStyle = "rgb(0,100,0)";
				}
				ctx.beginPath();
				ctx.arc((greenx+view+16)*scale,(greeny+viewy+16)*scale,(15)*scale,0,Math.PI*2,true);
				ctx.closePath();
				ctx.fill();
				if(lastlevel)
				{
					ctx.strokeStyle = "rgb(0,0,255)";
				}
				else
				{
					ctx.strokeStyle = "rgb(0,255,0)";
				}
				ctx.beginPath();
				ctx.arc((greenx+view+16)*scale,(greeny+viewy+16)*scale,(15)*scale,0,Math.PI*2,true);
				ctx.closePath();
				ctx.stroke();

				ctx.fillStyle = "rgb(255,0,0)";

			}
		}
		ctx.lineWidth = (2)*scale;//2;
		ctx.strokeStyle = "rgb(128,128,128)";
		for (var i = 0; i < box.length; i++)
		{
			ctx.strokeRect((view+box[i].x)*scale,(viewy+box[i].y)*scale,(box[i].width)*scale,(box[i].height)*scale);
			ctx.beginPath();
			ctx.moveTo((view+box[i].x)*scale,(viewy+box[i].y)*scale);
			ctx.lineTo((box[i].width+view+box[i].x)*scale,(box[i].y+viewy+box[i].height)*scale);
			ctx.moveTo((box[i].width+view+box[i].x)*scale,(viewy+box[i].y)*scale);
			ctx.lineTo((view+box[i].x)*scale,(box[i].y+viewy+box[i].height)*scale);
			ctx.closePath();
			ctx.stroke();
			if (box[i].fire > -1)
			{
				box[i].fire+=25;
				if (box[i].fire >= 300)
				{
					box[i].fire = 0;
				}
			}
			if (box[i].fire > -1)
			{
				switch (Math.floor(box[i].fire/100))
				{
					case 0:
						ctx.drawImage(fire1,(view+box[i].x-11)*scale,(viewy+box[i].y-39)*scale,fire1.width*scale,fire1.height*scale);
						break;
					case 1:
						ctx.drawImage(fire2,(view+box[i].x-11)*scale,(viewy+box[i].y-39)*scale,fire1.width*scale,fire1.height*scale);
						break;
					case 2:
						ctx.drawImage(fire3,(view+box[i].x-11)*scale,(viewy+box[i].y-39)*scale,fire1.width*scale,fire1.height*scale);
						break;
				}
				if (lastlevel)
				{
					ctx.drawImage(treasurefull,(view+box[i].x-40)*scale,(viewy+box[i].y+2)*scale,treasurefull.width*scale,treasurefull.height*scale);
				}

			}
		}
		//ctx.lineWidth = 1;

		/*if (grappleon)
		{
			ctx.fillStyle= "rgb(0,255,0)";
			ctx.fillText("Grapple Ready", 0, 10);
		}*/
			ctx.font = (24*scale)+"px Sans-Serif";
		for (var i = 0; i < text.length; i++)
		{
			if (text[i].x < 800-view && text[i].y+24 > -viewy && text[i].y-24 < 600-viewy)
			{
				ctx.fillStyle = "rgb(0,0,0)";
				ctx.fillText(text[i].txt,(text[i].x+1+view)*scale,(text[i].y-1+viewy)*scale);
				ctx.fillText(text[i].txt,(text[i].x+1+view)*scale,(text[i].y+viewy)*scale);
				ctx.fillText(text[i].txt,(text[i].x+1+view)*scale,(text[i].y+1+viewy)*scale);
				ctx.fillText(text[i].txt,(text[i].x+view)*scale,(text[i].y-1+viewy)*scale);
				ctx.fillText(text[i].txt,(text[i].x+view)*scale,(text[i].y+viewy)*scale);
				ctx.fillText(text[i].txt,(text[i].x+view)*scale,(text[i].y+1+viewy)*scale);
				ctx.fillText(text[i].txt,(text[i].x-1+view)*scale,(text[i].y-1+viewy)*scale);
				ctx.fillText(text[i].txt,(text[i].x-1+view)*scale,(text[i].y+viewy)*scale);
				ctx.fillText(text[i].txt,(text[i].x-1+view)*scale,(text[i].y+1+viewy)*scale);
				switch(text[i].color)
				{
					case 0:
						ctx.fillStyle = "rgb(0,255,0)";
						break;

					case 1:
						ctx.fillStyle = "rgb(0,128,255)";
						break;
				}
				ctx.fillText(text[i].txt,(text[i].x+view)*scale,(text[i].y+viewy)*scale);
			}
		}
		ctx.fillStyle= "rgb(0,255,0)";
		ctx.font = (10*scale)+"px Sans-Serif";
		//ctx.fillText("FPS: "+ Math.ceil(avgfps), 0, 8*scale);
		if (ingame){
			ctx.fillText("Level: "+ ((level%20)+1), 0, 8*scale);
		}
		var time =  (new Date()).getTime() - starttime;
		var min = Math.floor(time/60000);
		var sec = Math.floor((time-min*60000)/1000);
		if (min < 10)
		{
			min = "0" + min;
		}
		if (sec < 10)
		{
			sec = "0"+sec;
		}
		//ctx.fillText("Time: "+ min+":"+sec, 740*scale, 8*scale);
		if (besttime != "")
		{
			var min = Math.floor(besttime/60000);
			var sec = Math.floor((besttime-min*60000)/1000);
			if (min < 10)
			{
				min = "0" + min;
			}
			if (sec < 10)
			{
				sec = "0"+sec;
			}
			//ctx.fillText("Best: "+ min+":"+sec, 740*scale, 16*scale);
		}
		if (!ingame ){

			ctx.strokeStyle = "rgb(0,0,0)";

			if (selecting){
				ctx.fillStyle = menuColor;
				ctx.font = Math.round(40*scale)+"pt Arial";
				ctx.lineWidth = 2;
				var max = Number(localStorage[set]);
				for (var i = 0; i < 9; i++){
					if (i > max){
						break;
					}
					ctx.fillText(i+1,(256+8- 96 + 96* (i%5) + 10 )*scale,(192+51-64+ 96*Math.floor(i/5))*scale);
					ctx.strokeText(i+1,(256+8- 96+ 96* (i%5)+ 10 )*scale,(192+51-64+ 96*Math.floor(i/5))*scale);
				}
				for (var i = 9; i < 20; i++){
					if (i > max){
						break;
					}
					ctx.fillText(i+1,(256+8- 96 + 96* (i%5)  -6 )*scale,(192+51-64+ 96*Math.floor(i/5))*scale);
					ctx.strokeText(i+1,(256+8- 96+ 96* (i%5) -6 )*scale,(192+51-64+ 96*Math.floor(i/5))*scale);
				}
			}
			else{
			ctx.font = Math.round(60*scale)+"pt Arial";
				ctx.fillStyle = "rgb(0,255,255)";
				ctx.fillText("PART 1",(256+8)*scale,(192+61-64)*scale);
				ctx.strokeText("PART 1",(256+8)*scale,(192+61-64)*scale);

				ctx.fillStyle = "rgb(255,0,0)";
				ctx.fillText("PART 2",(256+8)*scale,(192+61-64+96)*scale);
				ctx.strokeText("PART 2",(256+8)*scale,(192+61-64+96)*scale);

				if (localStorage.beatOne || localStorage.beatTwo){
					ctx.fillStyle = "rgb(0,255,0)";
					ctx.fillText("PART 3",(256+8)*scale,(192+61-64+96*2)*scale);
					ctx.strokeText("PART 3",(256+8)*scale,(192+61-64+96*2)*scale);
				}

				if (localStorage.beatThree || (localStorage.beatOne && localStorage.beatTwo)){
					ctx.fillStyle = "rgb(255,255,0)";
					ctx.fillText("PART 4",(256+8)*scale,(192+61-64+96*3)*scale);
					ctx.strokeText("PART 4",(256+8)*scale,(192+61-64+96*3)*scale);
				}
			}
		}
		if (fade >0)
		{
			ctx.fillStyle = fadecolor+fade+")";
			ctx.fillRect(0,0,(800)*scale,(600)*scale);
		}


	}
	/*
		ctx.save();
		ctx.beginPath();
		ctx.rect(0,0,800,600-viewy);
		ctx.clip();
		ctx.drawImage(pauseWhite,800-32-6,6,32,32);
		ctx.restore();
	*/
	if (fade >0)
	{
		fade -= .05;
		if (fade < .05)
		{
			fade = 0;
		}
	}
}
function createBlock(x,y,width,height,move,buttonmode)
{
	block[topblock] = new Block();
	block[topblock].x = x;
	block[topblock].y = y;
	block[topblock].width = width;
	block[topblock].height = height;
	block[topblock].kill = false;
	block[topblock].grapple = false;
	block[topblock].ice = false;
	block[topblock].startx = x;
	block[topblock].starty = y;
	if (move)
	{
	block[topblock].move = true;
	block[topblock].count = move/2;
	block[topblock].max = move;
	}
	if (buttonmode)
	{
		block[topblock].buttonmode = buttonmode;
	}
	topblock ++;
}
function createIce(x,y,width,height,move,buttonmode)
{
	block[topblock] = new Block();
	block[topblock].x = x;
	block[topblock].y = y;
	block[topblock].width = width;
	block[topblock].height = height;
	block[topblock].kill = false;
	block[topblock].grapple = false;
	block[topblock].ice = true;
	block[topblock].startx = x;
	block[topblock].starty = y;
	if (move)
	{
	block[topblock].move = true;
	block[topblock].count = move/2;
	block[topblock].max = move;
	}
	if (buttonmode)
	{
		block[topblock].buttonmode = buttonmode;
	}
	topblock ++;
}
function createGradient(x,y,width,height,move,buttonmode)
{
	block[topblock] = new Block();
	block[topblock].x = x;
	block[topblock].y = y;
	block[topblock].width = width;
	block[topblock].height = height;
	block[topblock].kill = false;
	block[topblock].grapple = false;
	block[topblock].ice = false;
	block[topblock].gradient = true;
	block[topblock].b = false;
	block[topblock].startx = x;
	block[topblock].starty = y;
	if (move)
	{
	block[topblock].move = true;
	block[topblock].count = move/2;
	block[topblock].max = move;
	}
	if (buttonmode)
	{
		block[topblock].buttonmode = buttonmode;
	}
	topblock ++;
}
function createWin(x,y,width,height,move,buttonmode)
{
	block[topblock] = new Block();
	block[topblock].x = x;
	block[topblock].y = y;
	block[topblock].width = width;
	block[topblock].height = height;
	block[topblock].kill = false;
	block[topblock].grapple = false;
	block[topblock].ice = false;
	block[topblock].win = true;
	block[topblock].startx = x;
	block[topblock].starty = y;
	if (move)
	{
	block[topblock].move = true;
	block[topblock].count = move/2;
	block[topblock].max = move;
	}
	if (buttonmode)
	{
		block[topblock].buttonmode = buttonmode;
	}
	topblock ++;
}
function createKill(x,y,width,height,move,buttonmode)
{
	block[topblock] = new Block();
	block[topblock].x = x;
	block[topblock].y = y;
	block[topblock].width = width;
	block[topblock].height = height;
	block[topblock].kill = true;
	block[topblock].grapple = false;
	block[topblock].dir = false;
	block[topblock].startx = x;
	block[topblock].starty = y;
	if (move)
	{
	block[topblock].move = true;
	block[topblock].count = move/2;
	block[topblock].max = move;
	}
	if (buttonmode)
	{
		block[topblock].buttonmode = buttonmode;
	}
	topblock ++;
}
function createGrapple(x,y,width,height,move,buttonmode)
{
	block[topblock] = new Block();
	block[topblock].x = x;
	block[topblock].y = y;
	block[topblock].width = width;
	block[topblock].height = height;
	block[topblock].grapple = true;
	block[topblock].kill = false;
	block[topblock].dir = false;
	block[topblock].startx = x;
	block[topblock].starty = y;
	if (move)
	{
	block[topblock].move = true;
	block[topblock].count = move/2;
	block[topblock].max = move;
	}
	if (buttonmode)
	{
		block[topblock].buttonmode = buttonmode;
	}
	topblock ++;
}

function createBounce(x,y,width,height,move,buttonmode)
{
	block[topblock] = new Block();
	block[topblock].x = x;
	block[topblock].y = y;
	block[topblock].width = width;
	block[topblock].height = height;
	block[topblock].bounce = true;
	block[topblock].kill = false;
	block[topblock].dir = false;
	block[topblock].startx = x;
	block[topblock].starty = y;
	if (move)
	{
	block[topblock].move = true;
	block[topblock].count = move/2;
	block[topblock].max = move;
	}
	if (buttonmode)
	{
		block[topblock].buttonmode = buttonmode;
	}
	topblock ++;
}
function createBGradient(x,y,width,height,move,buttonmode)
{
	block[topblock] = new Block();
	block[topblock].x = x;
	block[topblock].y = y;
	block[topblock].width = width;
	block[topblock].height = height;
	block[topblock].kill = false;
	block[topblock].grapple = false;
	block[topblock].ice = false;
	block[topblock].gradient = true;
	block[topblock].b = true;
	block[topblock].startx = x;
	block[topblock].starty = y;
	if (move)
	{
		block[topblock].move = true;
		block[topblock].count = move/2;
		block[topblock].max = move;
	}
	if (buttonmode)
	{
		block[topblock].buttonmode = buttonmode;
	}
	topblock ++;
}
function createConveyor(x,y,width,height,move,buttonmode)
{
	block[topblock] = new Block();
	block[topblock].x = x;
	block[topblock].y = y;
	block[topblock].width = width;
	block[topblock].height = height;
	block[topblock].kill = false;
	block[topblock].grapple = false;
	block[topblock].ice = false;
	block[topblock].gradient = false;
	block[topblock].conveyor = true;
	block[topblock].bc = false;
	block[topblock].startx = x;
	block[topblock].starty = y;
	if (move)
	{
		block[topblock].move = true;
		block[topblock].count = move/2;
		block[topblock].max = move;
	}
	if (buttonmode)
	{
		block[topblock].buttonmode = buttonmode;
	}
	topblock ++;
}
function createBConveyor(x,y,width,height,move,buttonmode)
{
	block[topblock] = new Block();
	block[topblock].x = x;
	block[topblock].y = y;
	block[topblock].startx = x;
	block[topblock].starty = y;
	block[topblock].width = width;
	block[topblock].height = height;
	block[topblock].kill = false;
	block[topblock].grapple = false;
	block[topblock].ice = false;
	block[topblock].gradient = false;
	block[topblock].conveyor = true;
	block[topblock].bc = true;
	if (move)
	{
		block[topblock].move = true;
		block[topblock].count = move/2;
		block[topblock].max = move;
	}
	if (buttonmode)
	{
		block[topblock].buttonmode = buttonmode;
	}
	topblock ++;
}
function createPart(x,y,style)
{
	for (var i = 0; i < toppart; i++)
	{
		if (!part[i].on)
		{
			break;
		}
	}
	part[i] = new Part();
	part[i].on = true;
	part[i].x = x;
	part[i].y = y;
	part[i].style = style;
	if (i == toppart)
	{
		toppart++;
	}
}
function createStar(x,y)
{
	for (var i = 0; i < topstar; i++)
	{
		if (!star[i].on)
		{
			break;
		}
	}
	star[i] = new Star();
	star[i].on = true;
	star[i].x = x;
	star[i].y = y;
	if (i == topstar)
	{
		topstar++;
	}
}
function createCStar(x,y,destx,desty)
{
	for (var i = 0; i < topcstar; i++)
	{
		if (!cstar[i].on)
		{
			break;
		}
	}
	cstar[i] = new CStar();
	cstar[i].on = true;
	cstar[i].x = x;
	cstar[i].y = y;
	cstar[i].destx = destx;
	cstar[i].desty = desty;
	if (i == topcstar)
	{
		topcstar++;
	}
}
function createBox(x,y,width,height){
	var b = box.length;
	box[b] = new Box();
	box[b].x = x;
	box[b].y = y;
	box[b].width = width;
	box[b].height = height;
	box[b].botspeed = 0;
	box[b].botcount = 0;
}
function kill()
{
	//starttime = (new Date()).getTime();
	fade = 1;
	fadecolor = "rgba(255,0,0,";
	rotate = false;
	x = startx;
	y = starty;
	greenx = lastgreenx;
	greeny = lastgreeny;
	greenxspeed = 0;
	greenyspeed = 0;
	grapple = false;
	yspeed = 0;
	xspeed = 0;
	box = JSON.parse(oldbox);
	for (var i in block){
		if (block[i].move){
			block[i].count = block[i].max/2;
			block[i].dir = false;
			block[i].x = block[i].startx;
			block[i].y = block[i].starty;
		}
	}
	if (check){

		box = JSON.parse(check.box);
		for (var i in check.count){
			block[i].count = check.count[i];
			block[i].dir = check.dir[i];
			block[i].x = check.mx[i];
			block[i].y = check.my[i];
		}
		x = check.x;
		y = check.y;
		xspeed = check.xspeed;
		yspeed = check.yspeed;
		cLight = check.cLight;
	}

}
function circleCollide(b){
	Cx = Math.abs(x+16 - (b.x+b.width/2));
    Cy = Math.abs(y+16 - (b.y+b.height/2));

    if (Cx > (b.width/2 + 16)) { return false; }
    if (Cy > (b.height/2 + 16)) { return false; }

    if (Cx <= (b.width/2)) { return true; }
    if (Cy <= (b.height/2)) { return true; }

    cornerDistance_sq = Math.pow(Cx - b.width/2,2) +
                         Math.pow((Cy - b.height/2),2);

    return (cornerDistance_sq <= (16*16));

}
function win(){
/*	leftDown = false;
	rightDown = false;
	upDown = false;
	downDown = false;*/
//alert("you win");
	lastlevel = false;
	initfinal = true;
	initfinal2 = true;
	treasurex = 500;
	treasurey = 250;
	movefred = false;
	fire = false;
	box = [];
	block = [];
	topblock = 0;
	level ++;
	if (level == l.length || level%20 == 0)
	{

		switch (Math.floor((level-1)/20)){
			case 0:
				localStorage.beatOne = true;
				break;
			case 1:
				localStorage.beatTwo = true;
				break;
			case 2:
				localStorage.beatThree = true;
				break;
			case 3:
				localStorage.beatFour = true;
				break;
		}
		level = -1;
		ingame = false;
		var time =  (new Date()).getTime() - starttime;
		if (time < besttime || besttime == "")
		{
			besttime = time;
		}
		starttime = (new Date()).getTime();

	}
	else{
		switch (Math.floor(level/20)){
			case 0:
				if (level%20 > Number(localStorage.partOne)){
					localStorage.partOne = level%20;
				}
				break;

			case 1:
				if (level%20 > Number(localStorage.partTwo)){
					localStorage.partTwo = level%20;
				}
				break;


			case 2:
				if (level%20 > Number(localStorage.partThree)){
					localStorage.partThree = level%20;
				}
				break;
			case 3:
				if (level%20 > Number(localStorage.partFour)){
					localStorage.partFour = level%20;
				}
				break;
		}
	}
	gravoff = false;
	switchx = false;
	switchy = false;
	toucing = false;
	x = 0;
	y = 0;
	l[level]();
	startx = x;
	starty = y;
	oldbox = (JSON.stringify(box));
	lastgreenx = greenx;
	lastgreeny = greeny;
	kill();
	fadecolor = "rgba(255,255,0,";
}
function calcB(xx){

	var d = Math.abs(cLight-xx%300);
	if (d > 150){
		d = 300-d;
	}
	var b =  .1+30/(1+d);
	if (b > 1){
		b = 1;
	}
	return b;
}
function calcBB(xx){

	var d = Math.abs((300-cLight)-xx%300);
	if (d > 150){
		d = 300-d;
	}
	var b =  .1+30/(1+d);
	if (b > 1){
		b = 1;
	}
	return b;
}
function drawTopPlayer(xx,yy,ww,hh){
	ctx.save();
	ctx.beginPath();
	ctx.rect(xx,yy,ww,hh);
	ctx.clip();
	var al;
	if (y < 300)
	{
		al = ((300-32-y)/1000);
		al = 1-(al);
	}
	else{
		al = ((y-300)/1000)
		al = 1-(al);
	}
	al = Math.round(255*al);
	ctx.fillStyle = "rgb("+al+","+al+","+al+")";
	ctx.strokeStyle = "white";
	ctx.beginPath();
	ctx.arc((x+view+16)*scale,(y+viewy+16)*scale,(15)*scale,0,Math.PI*2,true);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = "rgb(255,0,0)";
	ctx.restore();
}
function drawPause(xx,yy,ww,hh,bw){
	if (gravoff){
		bw = false;
	}
	if (paused){
		return;
	}
	ctx.save();
	ctx.beginPath();
	ctx.rect(xx,yy,ww,hh);
	ctx.clip();
	if (bw){
		ctx.drawImage(pauseBlack,800*scale-32*scale-6*scale,6*scale,32*scale,32*scale);
	}
	else{
		ctx.drawImage(pauseWhite,800*scale-32*scale-6*scale,6*scale,32*scale,32*scale);
	}
	ctx.restore();
}
function drawBotPlayer(xx,yy,ww,hh){
	if (gravoff){
		return drawTopPlayer(xx,yy,ww,hh);
	}

	ctx.save();
	ctx.beginPath();
	ctx.rect(xx,yy,ww,hh);
	ctx.clip();
	var al;
	if (y < 300)
	{
		al = ((300-32-y)/1000);
	}
	else{
		al = ((y-300)/1000);
	}
	al = Math.round(255*al);
	ctx.fillStyle = "rgb("+al+","+al+","+al+")";
	ctx.strokeStyle = "black";
	ctx.beginPath();
	ctx.arc((x+view+16)*scale,(y+viewy+16)*scale,(15)*scale,0,Math.PI*2,true);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	ctx.fillStyle = "rgb(255,0,0)";
	ctx.restore();
}
function purgeButtons(){
	var beatOne = Boolean(localStorage.beatOne);
	var beatTwo = Boolean(localStorage.beatTwo);
	var beatThree = Boolean(localStorage.beatThree);
	var beatFour = Boolean(localStorage.beatFour);
	var hasThree = (beatOne || beatTwo);
	var hasFour = ((beatOne && beatTwo) || beatThree);
	var hasFive = (beatFour || (beatOne && beatTwo && beatThree));
	for (var i in block){
		if (block[i].bounce && !hasThree){
			block[i].x += 1000;
		}
		if (block[i].win && !hasFour){
			block[i].x += 1000;
		}
	}
	for (var i in box){
		if (!hasFive){
			box[i].x += 1000;
		}
	}
}
function setCursor(c){
	$('#screen').css("cursor",c);
}
function menu(){

	lastlevel = false;
	initfinal = true;
	initfinal2 = true;
	treasurex = 500;
	treasurey = 250;
	movefred = false;
	fire = false;
	box = [];
	block = [];
	topblock = 0;
	level =-1;

	gravoff = false;
	switchx = false;
	switchy = false;
	toucing = false;
	x = 0;
	y = 0;
	l[level]();
	ingame = false;
	selecting = false;
	startx = x;
	starty = y;
	oldbox = (JSON.stringify(box));
	lastgreenx = greenx;
	lastgreeny = greeny;
	kill();
	fadecolor = "rgba(0,0,255,";
}
