//    abc_graphelements.js: All the drawable and layoutable datastructures to be printed by ABCPrinter
//    Copyright (C) 2010 Gregory Dyke (gregdyke at gmail dot com)
//
//    This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.

/*global ABCPrinter, sprintf, AbcSpacing, getDurlog */
/*extern  ABCVoiceElement ABCRelativeElement ABCAbsoluteElement ABCBeamElem ABCEndingElem ABCTripletElem ABCTieElem ABCStaffGroupElement*/

function ABCStaffGroupElement() {
  this.voices = [];
  this.staffs = [];
}

ABCStaffGroupElement.prototype.addVoice = function (voice) {
  this.voices[this.voices.length] = voice;
  for (var i=0; i<this.staffs.length;i++) {
    if (this.staffs[i]==voice.y) return;
  }
  this.staffs[this.staffs.length] = voice.y;
};

ABCStaffGroupElement.prototype.finished = function() {
  for (var i=0;i<this.voices.length;i++) {
    if (!this.voices[i].layoutEnded()) return false;
  }
  return true;
};

ABCStaffGroupElement.prototype.layout = function(spacing) {
  var x = 0;
  var currentduration = 0;
  for (var i=0;i<this.voices.length;i++) {
    this.voices[i].beginLayout();
  }

  while (!this.finished()) {
    var childx=x;
    var cont=true;
    // find smallest duration to be laid out among candidates across voices
    currentduration= null; 
    for (var i=0;i<this.voices.length;i++) {
      if (!this.voices[i].layoutEnded() && (!currentduration || this.voices[i].durationindex<currentduration)) currentduration=this.voices[i].durationindex;
    }

    // among the current duration level find the one which needs starting furthest right
    for (var i=0;i<this.voices.length;i++) {
      if (this.voices[i].durationindex != currentduration) continue;
      if (this.voices[i].nextx>x) x=this.voices[i].nextx;
    }
    while (cont) {
      cont = false;
      for (var i=0;i<this.voices.length;i++) {
	if (this.voices[i].durationindex != currentduration) continue;
	var voicechildx = this.voices[i].layoutOneItem(x,childx,spacing);
	if (voicechildx>childx) {
	  childx = voicechildx;
	  cont = true; //TODO not optimised for single cases
	} 
      }
    }
    for (var i=0;i<this.voices.length;i++) {
      var voice = this.voices[i]; 
      if (voice.durationindex != currentduration) continue;
      voice.updateIndices();
    }
  }
  // increment to the greatest x
  for (var i=0;i<this.voices.length;i++) {
    if (this.voices[i].nextx>x) x=this.voices[i].nextx;
  }

  this.w = x;
};

ABCStaffGroupElement.prototype.draw = function (printer) {
  for (var i=0;i<this.voices.length;i++) {
    this.voices[i].draw(printer);
  }

  if (this.staffs.length>1) {
    printer.setY(this.staffs[0]);
    var top = printer.calcY(10);
    printer.setY(this.staffs[this.staffs.length-1]);
    var bottom = printer.calcY(2);
    printer.printStem(0, 0.6, top, bottom);
  }

  for (var i=0;i<this.staffs.length;i++) {
    printer.setY(this.staffs[i]);
    printer.printStave(this.w);
  }
  printer.unSetY();
};

function ABCVoiceElement(y) {
  this.children = [];
  this.beams = []; 
  this.otherchildren = []; // ties, slurs, triplets
  this.w = 0;
  this.y = y;
}

ABCVoiceElement.prototype.addChild = function (child) {
  this.children[this.children.length] = child;
};

ABCVoiceElement.prototype.addInvisibleChild = function (child) {
  child.invisible = true;
  this.addChild(child);
};

ABCVoiceElement.prototype.addOther = function (child) {
  if (child instanceof ABCBeamElem) {
    this.beams.push(child);
  } else {
    this.otherchildren.push(child);
  }
};

ABCVoiceElement.prototype.updateIndices = function () {
  if (!this.layoutEnded()) {
    this.durationindex += this.children[this.i].duration;
    this.i++;
  }
}; 

ABCVoiceElement.prototype.layoutEnded = function () {
  return (this.i>=this.children.length);
};

ABCVoiceElement.prototype.beginLayout = function () {
  this.i=0;
  this.durationindex=0;
  this.ii=this.children.length;
  this.extraroom=0;
  this.durationroom=0;
  this.room=0;
  this.nextx=0;
};

ABCVoiceElement.prototype.layoutOneItem = function (x, childx, spacing) {
  var child = this.children[this.i];
  if (!child) return {x: 0, childx: 0};
  var er = child.getExtraWidth() - this.room;
  if (er>0) {
    x+=child.getExtraWidth();
    this.extraroom+=er;
  }
  if (x<childx) x=childx;
  child.x=x;
  x+=(spacing*Math.sqrt(child.duration*8));
  er = child.x+child.getMinWidth() - x;
  if (er > 0) {
    x = child.x+child.getMinWidth();
    (this.i!=this.ii-1) && (x+=child.minspacing);
    this.extraroom+=er;
    this.room = 0;
  } else {
    this.room = -er;
    this.durationroom+=(spacing*Math.sqrt(child.duration*8));
  }
  this.w = x;
  this.nextx = x;
  return child.x;
};

ABCVoiceElement.prototype.draw = function (printer) {
  var width = this.w-1;
  printer.setY(this.y);

  this.children.each(function(child) {
      child.draw(printer,10,width);
    });
  this.beams.each(function(beam) {
      beam.draw(printer,10,width);
    });
  this.otherchildren.each(function(child) {
      child.draw(printer,10,width);
    });

  if (this.header) {
    printer.paper.text(100, this.y, this.header);
  }
  printer.unSetY();
};


function ABCAbsoluteElement(abcelem, duration, minspacing) { // spacing which must be taken on top of the width
  this.abcelem = abcelem;
  this.duration = duration;
  this.minspacing = minspacing || 0;
  this.x = 0;
  this.children = [];
  this.heads = [];
  this.extra = [];
  this.extraw = 0;
  this.decs = [];
  this.w = 0;
  this.right = [];
}

ABCAbsoluteElement.prototype.getMinWidth = function () { // absolute space taken to the right of the note
  return this.w;
};

ABCAbsoluteElement.prototype.getExtraWidth = function () { // space needed to the left of the note
  return -this.extraw;
};

ABCAbsoluteElement.prototype.addExtra = function (extra) {
  if (extra.dx<this.extraw) this.extraw = extra.dx;
  this.extra[this.extra.length] = extra;
  this.addChild(extra);
};

ABCAbsoluteElement.prototype.addHead = function (head) {
  if (head.dx<this.extraw) this.extraw = head.dx;
  this.heads[this.heads.length] = head;
  this.addRight(head);
};

ABCAbsoluteElement.prototype.addRight = function (right) {
  if (right.dx+right.w>this.w) this.w = right.dx+right.w;
  this.right[this.right.length] = right;
  this.addChild(right);
};

ABCAbsoluteElement.prototype.addChild = function (child) {
  child.parent = this;
  this.children[this.children.length] = child;
};

ABCAbsoluteElement.prototype.draw = function (printer) {
  this.elemset = printer.paper.set();
  if (this.invisible) return;
  for (var i=0; i<this.children.length; i++) {
    this.elemset.push(this.children[i].draw(printer,this.x));
  }
  var self = this;
  this.elemset.mouseup(function (e) {
      printer.notifySelect(self);
    });
};

ABCAbsoluteElement.prototype.highlight = function () {
  this.elemset.attr({fill:"#ff0000"});
};

ABCAbsoluteElement.prototype.unhighlight = function () {
  this.elemset.attr({fill:"#000000"});
};

function ABCRelativeElement(c, dx, w, pitch, opt) {
  opt = opt || {};
  this.x = 0;
  this.c = c;      // character or path or string
  this.dx = dx;    // relative x position
  this.w = w;      // minimum width taken up by this element (can include gratuitous space)
  this.pitch = pitch; // relative y position by pitch
  this.scalex = opt["scalex"] || 1; // should the character/path be scaled?
  this.scaley = opt["scaley"] || 1; // should the character/path be scaled?
  this.type = opt["type"] || "symbol"; // cheap types.
  this.pitch2 = opt["pitch2"];
  this.linewidth = opt["linewidth"];
}

ABCRelativeElement.prototype.draw = function (printer, x) {
  this.x = x+this.dx;
  switch(this.type) {
  case "symbol":
    if (this.c===null) return null;
    this.graphelem = printer.printSymbol(this.x, this.pitch, this.c, 0, 0); break;
  case "debug":
    this.graphelem = printer.debugMsg(this.x, this.c); break;
  case "debugLow":
    this.graphelem = printer.debugMsgLow(this.x, this.c); break;
  case "text":
    this.graphelem = printer.printText(this.x, this.pitch, this.c); break;
  case "stem":
    this.graphelem = printer.printStem(this.x, this.linewidth, printer.calcY(this.pitch), printer.calcY(this.pitch2)); break;
  case "ledger":
    this.graphelem = printer.printStaveLine(this.x, this.x+this.w, this.pitch); break;
  }
  if (this.scalex!=1 && this.graphelem) {
    this.graphelem.scale(this.scalex, this.scaley, this.x, printer.calcY(this.pitch));
  }
  return this.graphelem;
};

function ABCEndingElem (text, anchor1, anchor2) {
  this.text = text; // text to be displayed top left
  this.anchor1 = anchor1; // must have a .x property or be null (means starts at the "beginning" of the line - after keysig)
  this.anchor2 = anchor2; // must have a .x property or be null (means ends at the end of the line)
}

ABCEndingElem.prototype.draw = function (printer, linestartx, lineendx) {
  if (this.anchor1) {
    linestartx = this.anchor1.x+this.anchor1.w;
    printer.paper.path(sprintf("M %f %f L %f %f",
			       linestartx, printer.y, linestartx, printer.y+10)).attr({stroke:"#000000"});
    printer.printText(linestartx+5, 18.5, this.text);
  }

  if (this.anchor2) {
    lineendx = this.anchor2.x;
    printer.paper.path(sprintf("M %f %f L %f %f",
			   lineendx, printer.y, lineendx, printer.y+10)).attr({stroke:"#000000"});
  }
  printer.paper.path(sprintf("M %f %f L %f %f",
			    linestartx, printer.y, lineendx, printer.y)).attr({stroke:"#000000"});
  
};

function ABCTieElem (anchor1, anchor2, above, force) {
  this.anchor1 = anchor1; // must have a .x and a .pitch, and a .parent property or be null (means starts at the "beginning" of the line - after keysig)
  this.anchor2 = anchor2; // must have a .x and a .pitch property or be null (means ends at the end of the line)
  this.above = above; // true if the arc curves above
  this.force = force;
}

ABCTieElem.prototype.draw = function (printer, linestartx, lineendx) {
  // TODO end and beginning of line

  if (this.anchor1 && this.anchor2) {
    if (!this.force && this.anchor1.parent.beam && this.anchor2.parent.beam && 
	this.anchor1.parent.beam.asc===this.anchor2.parent.beam.asc) {
      this.above = !this.anchor1.parent.beam.asc;
    }
    printer.drawArc(this.anchor1.x, this.anchor2.x, this.anchor1.pitch, this.anchor2.pitch,  this.above);
  }
};

function ABCTripletElem (number, anchor1, anchor2, above) {
  this.anchor1 = anchor1; // must have a .x and a .parent property or be null (means starts at the "beginning" of the line - after keysig)
  this.anchor2 = anchor2; // must have a .x property or be null (means ends at the end of the line)
  this.above = above;
  this.number = number;
}

ABCTripletElem.prototype.draw = function (printer, linestartx, lineendx) {
  // TODO end and beginning of line
  if (this.anchor1 && this.anchor2) {
    var ypos = this.above?14:-1;
    
    if (this.anchor1.parent.beam && 
	this.anchor1.parent.beam===this.anchor2.parent.beam) {
      var beam = this.anchor1.parent.beam;
      this.above = beam.asc;
      ypos = beam.pos;     
    } else {
      this.drawLine(printer,printer.calcY(ypos));
    }
    var xsum = this.anchor1.x+this.anchor2.x;
    var ydelta = 0;
    if (beam) {
      if (this.above) {
	xsum += (this.anchor2.w + this.anchor1.w);
	ydelta = 4;
      } else {
	ydelta = -4;
      }
    } else {
      xsum += this.anchor2.w;
    }
    
    
    printer.printText(xsum/2, ypos+ydelta, this.number, "middle");

  }
};

ABCTripletElem.prototype.drawLine = function (printer, y) {
  var linestartx = this.anchor1.x;
  printer.paper.path(sprintf("M %f %f L %f %f",
			     linestartx, y, linestartx, y+5)).attr({stroke:"#000000"});
  
  var lineendx = this.anchor2.x+this.anchor2.w;
  printer.paper.path(sprintf("M %f %f L %f %f",
			     lineendx, y, lineendx, y+5)).attr({stroke:"#000000"});
  
  printer.paper.path(sprintf("M %f %f L %f %f",
			     linestartx, y, (linestartx+lineendx)/2-5, y)).attr({stroke:"#000000"});

  printer.paper.path(sprintf("M %f %f L %f %f",
			    (linestartx+lineendx)/2+5, y, lineendx, y)).attr({stroke:"#000000"});

};

function ABCBeamElem (type, flat) {
  this.isflat = (flat);
  this.isgrace = (type && type==="grace");
  this.forceup = (type && type==="up");
  this.forcedown = (type && type==="down");
  this.elems = []; // all the ABCAbsoluteElements
  this.total = 0;
  this.dy = (this.asc)?AbcSpacing.STEP:-AbcSpacing.STEP;
  if (this.isgrace) this.dy = this.dy*0.4;
  this.allrests = true;
}

ABCBeamElem.prototype.add = function(abselem) {
  this.allrests = this.allrests && abselem.abcelem.rest;
  abselem.beam = this;
  this.elems.push(abselem);
  var pitch = abselem.abcelem.averagepitch;
  this.total += pitch; // TODO CHORD (get pitches from abselem.heads)
  if (!this.min || abselem.abcelem.minpitch<this.min) {
    this.min = abselem.abcelem.minpitch;
  }
  if (!this.max || abselem.abcelem.maxpitch>this.max) {
    this.max = abselem.abcelem.maxpitch;
  }
};

ABCBeamElem.prototype.average = function() {
  try {
    return this.total/this.elems.length;
  } catch (e) {
    return 0;
  }
};

ABCBeamElem.prototype.draw = function(printer) {
  if (this.elems.length === 0 || this.allrests) return;
  this.drawBeam(printer);
  this.drawStems(printer);
};


ABCBeamElem.prototype.drawBeam = function(printer) {

  var average = this.average();
  var barpos = (this.isgrace)? 5:7;
  var barminpos = 5;
  this.asc = (this.forceup || this.isgrace || average<6) && (!this.forcedown); // hardcoded 6 is B
  this.pos = Math.round(this.asc ? Math.max(average+barpos,this.max+barminpos) : Math.min(average-barpos,this.min-barminpos));
  var slant = this.elems[0].abcelem.averagepitch-this.elems[this.elems.length-1].abcelem.averagepitch;
  if (this.isflat) slant=0;
  var maxslant = this.elems.length/2;

  if (slant>maxslant) slant = maxslant;
  if (slant<-maxslant) slant = -maxslant;
  this.starty = printer.calcY(this.pos+Math.floor(slant/2));
  this.endy = printer.calcY(this.pos+Math.floor(-slant/2));
  this.startx = this.elems[0].heads[0].x;
  if(this.asc) this.startx+=this.elems[0].heads[0].w-0.6;
  this.endx = this.elems[this.elems.length-1].heads[0].x;
  if(this.asc) this.endx+=this.elems[this.elems.length-1].heads[0].w-0.6;


  printer.paper.path("M"+this.startx+" "+this.starty+" L"+this.endx+" "+this.endy+
	     "L"+this.endx+" "+(this.endy+this.dy) +" L"+this.startx+" "+(this.starty+this.dy)+"z").attr({fill: "#000000"});
};

ABCBeamElem.prototype.drawStems = function(printer) {
  var auxbeams = [];  // auxbeam will be {x, y, durlog, single} auxbeam[0] should match with durlog=-4 (16th) (j=-4-durlog)
  for (var i=0,ii=this.elems.length; i<ii; i++) {
    if (this.elems[i].abcelem.rest)
      continue;
    var furthesthead = this.elems[i].heads[(this.asc)? 0: this.elems[i].heads.length-1];
    var ovaldelta = (this.isgrace)?1/3:1/5;
    var pitch = furthesthead.pitch + ((this.asc) ? ovaldelta : -ovaldelta);
    var y = printer.calcY(pitch);
    var x = furthesthead.x + ((this.asc) ? furthesthead.w: 0);
    var bary=this.getBarYAt(x);
    var dx = (this.asc) ? -0.6 : 0.6;
    printer.printStem(x,dx,y,bary);

    var sy = (this.asc) ? 1.5*AbcSpacing.STEP: -1.5*AbcSpacing.STEP;
    (this.isgrace) && (sy = sy*2/3);
    for (var durlog=getDurlog(this.elems[i].duration); durlog<-3; durlog++) {
      if (auxbeams[-4-durlog]) {
	auxbeams[-4-durlog].single = false;
      } else {
	auxbeams[-4-durlog] = {x:x+((this.asc)?-0.6:0), y:bary+sy*(-4-durlog+1), 
			       durlog:durlog, single:true};
      }
    }
    
    for (var j=auxbeams.length-1;j>=0;j--) {
      if (i===ii-1 || getDurlog(this.elems[i+1].duration)>(-j-4)) {
	
	var auxbeamendx = x;
	var auxbeamendy = bary + sy*(j+1);


	if (auxbeams[j].single) {
	  auxbeamendx = (i===0) ? x+5 : x-5;
	  auxbeamendy = this.getBarYAt(auxbeamendx) + sy*(j+1);
	}
	printer.paper.path("M"+auxbeams[j].x+" "+auxbeams[j].y+" L"+auxbeamendx+" "+auxbeamendy+
		   "L"+auxbeamendx+" "+(auxbeamendy+this.dy) +" L"+auxbeams[j].x+" "+(auxbeams[j].y+this.dy)+"z").attr({fill: "#000000"});
	auxbeams = auxbeams.slice(0,j);
      }
    }
  }
};

ABCBeamElem.prototype.getBarYAt = function(x) {
  return this.starty + (this.endy-this.starty)/(this.endx-this.startx)*(x-this.startx);
};