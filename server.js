var http = require("http");
var url = require('url');
var fs = require('fs');
var io = require('socket.io');


function shuffle(ob) {
	for (var i = ob.length; i > 0; i --) {
        var j = Math.floor(Math.random() * i);
		var tmp = ob[i - 1];
        ob[i - 1] = ob[j];
		ob[j] = tmp;
    }
}




function bridge_game(){
	
	this.pass_count = 0;
	this.target = Math.floor((Math.random() * 4) + 1);
	this.display_message = "wait";
	this.state = 0;
	this.player_sit = [1,2,3,4];
	this.player_cards= [];
	this.target_color = 0;
	this.target_count = 0;
	this.table_card = new Array(4);
	this.bid = [0,0];
	this.teams = [0,0];
	this.goals = [7,7];
	this.on_table = [-1, -1, -1,- 1];
	
	for(var i = 0; i < 4; i ++) this.player_cards[i]= [];
	
	var cards = [];
	for(var i = 0; i < 52; i ++) cards[i] = i + 1;
	shuffle(cards);
	
	for(var i = 0; i < 13; i ++)
		this.player_cards[0][i] = cards[i];
	for(var i = 13; i < 26; i++)
		this.player_cards[1][i - 13] = cards[i];
	for(var i = 26; i < 39; i ++)
		this.player_cards[2][i - 26] = cards[i];
	for(var i = 39; i < 52; i ++)
		this.player_cards[3][i - 39] = cards[i];
	for(var i = 0; i < 4; i ++)
		this.player_cards[i].sort(function(a, b){ return a - b; });
	shuffle(this.player_sit);
	
	
}



var game_data = [];
var player_count = 0;


var server = http.createServer(function(request, response) {
	console.log('Connection');
	var path = url.parse(request.url).pathname;

	switch (path) {
		case '/':
			response.writeHead(200, {'Content-Type': 'text/html'});
			response.write('Hello, World.');
			response.end();
			break;
		case '/index.html':
			fs.readFile(__dirname + path, function(error, data) {
				if (error){
					response.writeHead(404);
					response.write("opps this doesn't exist - 404");
				}
				else {
					response.writeHead(200, {"Content-Type": "text/html"});
					response.write(data, "utf8");
				}
				response.end();
			});
			break;
		case '/poker.min.js':
			fs.readFile(__dirname + path, function(error, data) {
				if (error){
					response.writeHead(404);
					response.write("opps this doesn't exist - 404");
				}
				else {
					response.writeHead(200, {"Content-Type": "text/html"});
					response.write(data, "utf8");
				}
				response.end();
			});
			break
		default:
			response.writeHead(404);
			response.write("opps this doesn't exist - 404");
			response.end();
			break;
	}
});

server.listen(5566);


	

var serv_io = io.listen(server); // 開啟 Socket.IO 的 listener
serv_io.sockets.on('connection', function(socket) {
	
	
	var member_id = ++player_count;
	var player_id = (member_id-1)%4+1;
	
	socket.emit('player_id', {'player_id': player_id , 'state': 0, 'display_message': "wait"});
	
	if( player_count%4 == 1) game_data[Math.floor(player_count/4)] = new bridge_game();
	else if( player_count && player_count%4 == 0 ){
		game_data[player_count/4-1].state = 1;
		game_data[player_count/4-1].display_message = "start";
	}		
		
	socket.on('request_data', function(data) {
		var current_table = game_data[Math.floor((member_id-1)/4)];
		
		socket.emit('get_data', {'player_id': data.player_id,
					'state': current_table.state,
					'display_message': current_table.display_message,
					'player_cards': current_table.player_cards[Number(player_id) - 1],
					'player_sit': current_table.player_sit,
					'teams': current_table.teams,
					'goals': current_table.goals,
					'on_table': current_table.on_table,
					'moving': current_table.player_sit[current_table.target - 1],
					'current_call': current_table.bid[1]
					});
		if((current_table.player_sit[current_table.target - 1] == player_id) && current_table.state == 1) socket.emit('call', {'current_call': current_table.bid[1]});
		
	});
	socket.on('user_data', function(data) {
		var current_table = game_data[Math.floor((member_id-1)/4)];
		switch(current_table.state){
			case 1:
				if(player_id == current_table.player_sit[current_table.target - 1] &&  parseInt(data.user_data) > current_table.bid[1]){
					current_table.bid[0] = current_table.target;
					current_table.bid[1] = parseInt(data.user_data);
					current_table.display_message = "Player " + current_table.player_sit[current_table.target - 1]+ " bids " + current_table.bid[1] + "\n";
					current_table.target = current_table.target + 1;
					if(current_table.target == 5 ) current_table.target = 1;
					current_table.display_message += "Is Player " + current_table.player_sit[current_table.target - 1] + " turn";
					current_table.pass_count = 0;
				}
				else if(player_id == current_table.player_sit[current_table.target - 1] && data.user_data == "pass"){
					if(current_table.bid[1] == 0) break;
					current_table.pass_count ++;
					if(current_table.pass_count >= 3){
						current_table.target = current_table.bid[0] + 1;
						if(current_table.target == 5) current_table.target = 1;
						current_table.display_message = "Final is Player " + current_table.player_sit[current_table.bid[0] - 1] + " with " + current_table.bid[1] + "\nIs Player " ;
						current_table.display_message += current_table.player_sit[current_table.target - 1] + " turn";
						var t = current_table.player_sit.indexOf(current_table.bid[0]) % 2 ;
						current_table.goals[t] = 6 + Math.floor( (current_table.bid[1] - 1) / 5 + 1);
						current_table.goals[(t + 1) % 2] = 14 - current_table.goals[t] ;
						current_table.state = 2;
					}
					else {
						var message = current_table.display_message.split("\n");
						current_table.target = current_table.target + 1;
						if(current_table.target == 5 ) current_table.target = 1;
						current_table.display_message = message[0] + "\nIs Player " + current_table.player_sit[current_table.target - 1] + " turn";
					}
				}
				break;
			case 2:
				var card = Number(data.user_data);
				var card_color = Math.floor((card - 1) / 13) + 1;
				var king_color = (current_table.bid[1] - 1) % 5 + 1;
				var index = current_table.player_cards[player_id - 1].indexOf(card);
				if( player_id == current_table.player_sit[current_table.target - 1] && index != -1 ){
					if(current_table.target_count == 0 || card_color == current_table.target_color){
						if(current_table.target_count==0){
							current_table.on_table = [-1, -1, -1, -1];
							current_table.target_color = card_color ;
							current_table.display_message = "Player " + player_id + " throw out " + card;
						}
						else 
							current_table.display_message += "\nPlayer " + player_id + " throw out " + card;
						
						current_table.table_card[current_table.target_count ++] =  card;
						current_table.player_cards[player_id - 1][index] = -1;
						current_table.on_table[player_id - 1] = card;
						
						if(current_table.target_count < 4){
							current_table.target = current_table.target + 1;
							if(current_table.target == 5 ) current_table.target = 1;
							current_table.display_message += "\nIs Player " + current_table.player_sit[current_table.target - 1] + " turn";
						}
					}
					else {
						var error = false;
						for(var i = 1; i <= 13; i ++){
							if( current_table.player_cards[player_id - 1].indexOf(i + (current_table.target_color - 1) * 13) != -1){
								error = true;
								break;
							}
						}
						if(error) break;
						current_table.display_message += "\nPlayer " + player_id + " throw out " + card;
						current_table.table_card[current_table.target_count ++] = card;
						current_table.player_cards[player_id - 1][index] = -1;
						current_table.on_table[player_id - 1] = card;
						
						if(current_table.target_count < 4){
							current_table.target = current_table.target + 1;
							if(current_table.target == 5 ) current_table.target = 1;
							current_table.display_message += "\nIs Player " + current_table.player_sit[current_table.target - 1] + " turn";
						}
						
					}
					if(current_table.target_count >= 4){
						var winner = 0,win_scroce = 0,scroce = 0;
						
						for(var i = 0; i < 4; i ++){
							scroce = 0; 
							current_table.target = current_table.target + 1;
							if(current_table.target == 5 ) current_table.target = 1;
							if(Math.floor((current_table.table_card[i] - 1) / 13) + 1 == king_color) scroce =  ((current_table.table_card[i] - 1) % 13 + 1) * 100;
							else if(Math.floor((current_table.table_card[i] - 1) / 13) + 1 == current_table.target_color) scroce =  ((current_table.table_card[i] - 1) % 13 + 1) * 1;
							else scroce = 0;
							if(scroce > win_scroce){
								winner = current_table.target;
								win_scroce = scroce;
							}
						}
						current_table.teams[current_table.player_sit.indexOf(winner) % 2] ++;
						if(current_table.teams[current_table.player_sit.indexOf(winner) % 2] == current_table.goals[current_table.player_sit.indexOf(winner) % 2]){
							if(current_table.player_sit.indexOf(winner) % 2 == 0) current_table.display_message = "Team A Win";
							else current_table.display_message = "Team B Win";
							socket.emit('over', {'winner': (current_table.player_sit.indexOf(winner) % 2)});
							current_table.state = 3;
							break;
						}								
						current_table.display_message = "This round winner is Player "+current_table.player_sit[winner - 1];
						current_table.target = winner;
						current_table.display_message += "\nIs Player " + current_table.player_sit[current_table.target - 1]+ " turn";
						current_table.target_count = 0;
					}
				}
				break;
			default:
				break;
		}
		socket.emit('get_data', {'player_id': player_id,
					'state': current_table.state,
					'display_message': current_table.display_message,
					'player_cards': current_table.player_cards[Number(player_id) - 1],
					'player_sit': current_table.player_sit,
					'teams': current_table.teams,
					'goals': current_table.goals,
					'on_table': current_table.on_table,
					'moving': current_table.player_sit[current_table.target - 1],
					'current_call': current_table.bid[1]
					});
		if((current_table.player_sit[current_table.target - 1] == player_id) && current_table.state == 1) socket.emit('call', {'current_call': current_table.bid[1]});
	});
});