var http = require("http");
var url = require('url');
var fs = require('fs');
var io = require('socket.io');

var player_count = 0;
var pass_count = 0;
var display_message = "wait"; 
var state=0;
var player_sit=[];
var player_cards= new Array(4);
var target = 0;
var target_color = 0;
var target_count = 0;
var table_card = new Array(4);
var bid = [];
var teams = new Array(2);
var goals = new Array(2);
var on_table = [-1,-1,-1,-1];


for(var i=0;i<4;i++)
{
	player_sit[i]=i+1;
	player_cards[i]= new Array(13);
	
}	

var server = http.createServer(function(request, response) {
  console.log('Connection');
  var path = url.parse(request.url).pathname;

  switch (path) {
    case '/':
      response.writeHead(200, {'Content-Type': 'text/html'});
      response.write('Hello, World.');
      response.end();
      break;
    case '/socket.html':
      fs.readFile(__dirname + path, function(error, data) {
        if (error){
          response.writeHead(404);
          response.write("opps this doesn't exist - 404");
        } else {
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
        } else {
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

server.listen(5577);

function shuffle(ob){
	for (var i = ob.length; i>0; i--) {
        var j = Math.floor(Math.random() * i);
        [ob[i - 1], ob[j]] = [ob[j], ob[i - 1]];
    }
}


var serv_io = io.listen(server); // 開啟 Socket.IO 的 listener
serv_io.sockets.on('connection', function(socket) {
		socket.emit('player_id', {'player_id': ++player_count ,'state': 0,'display_message':display_message});
		if(player_count==4){
			
			var cards = [];
			for(var i=0;i<52;i++) cards[i]=i+1;
			shuffle(cards);
			
			for(var i=0;i<13;i++)
				player_cards[0][i] = cards[i];
			for(var i=13;i<26;i++)
				player_cards[1][i-13] = cards[i];
			for(var i=26;i<39;i++)
				player_cards[2][i-26] = cards[i];
			for(var i=39;i<52;i++)
				player_cards[3][i-39] = cards[i];
			
			for(var i=0;i<4;i++)
				player_cards[i].sort(function(a,b){return a-b;});
			
		
			shuffle(player_sit);
			bid[0] = bid[1] = 0;
			teams[0] = teams[1] = 0;
			goals[0] = goals[1] = 7;
			pass_count = 0;
			state=1;
			target = Math.floor((Math.random() * 4) + 1);
			display_message = "start bidding at Player "+ player_sit[target-1];
			player_count = 0;
		}
		socket.on('request_data', function(data) {
			socket.emit('get_data', {'player_id': data.player_id,
									'display_message': display_message,
									'player_cards':player_cards[Number(data.player_id)-1],
									'player_sit':player_sit,
									'teams':teams,
									'goals':goals,
									'on_table':on_table});
		});
		socket.on('user_data', function(data) {
			switch(state){
				case 1:
					if(data.player_id == player_sit[target-1] &&  parseInt(data.user_data) > bid[1]){
						bid[0] = target;
						bid[1] = parseInt(data.user_data);
						display_message = "Player "+player_sit[target-1]+" bids "+ bid[1] + "\n";
						target = target+1;
						if(target == 5 ) target=1;
						display_message += "Is Player "+player_sit[target-1]+ " turn";
						pass_count = 0;
					}
					else if(data.player_id == player_sit[target-1] && data.user_data=="pass"){
						if( bid[1] == 0 ) break;
						pass_count++;
						if(pass_count>=3) {
							target = bid[0]+1;
							if(target == 5 ) target=1;
							display_message = "Final is Player "+player_sit[bid[0]-1]+" with "+bid[1]+"\nIs Player "+player_sit[target-1]+" turn";
							var t= player_sit.indexOf(bid[0])%2 ;
							goals[t] = 7 + Math.floor( (bid[1]-1)/5+1) ;
							goals[(t+1)%2] = 14-goals[t] ;
							state=2;
						}
						else {
							var message = display_message.split("\n");
							target = target+1;
							if(target == 5 ) target=1;
							display_message = message[0] + "\nIs Player "+player_sit[target-1]+ " turn";
						}
					}
					break;
				case 2:
					var card = Number(data.user_data);
					var card_color = Math.floor((card-1)/13)+1;
					var king_color = (bid[1]-1)%5+1;
					var index = player_cards[data.player_id-1].indexOf(card);
					if( data.player_id == player_sit[target-1] && index != -1 )
					{
						if(target_count==0 || card_color == target_color) {
							if(target_count==0){
								target_color = card_color ;
								display_message = "Player "+data.player_id+ " throw out "+card;
							}
							else 
								display_message += "\nPlayer "+data.player_id+ " throw out "+card;
							
							table_card[target_count++] =  card;
							player_cards[data.player_id-1][index] = -1;
							on_table[data.player_id-1] = card;
							
							if(target_count<4) {
								target = target+1;
								if(target == 5 ) target=1;
								display_message += "\nIs Player "+player_sit[target-1]+ " turn";
							}
							
						}
						else {
							var error = false;
							for(var i=1;i<=13;i++){
								if( player_cards[data.player_id-1].indexOf(i+(target_color-1)*13) != -1){
									error = true;
									break;
								}
							}
							if(error) break;
							display_message += "\nPlayer "+data.player_id+ " throw out "+card;
							table_card[target_count++] =  card;
							player_cards[data.player_id-1][index] = -1;
							on_table[data.player_id-1] = card;
							
							if(target_count<4) {
								target = target+1;
								if(target == 5 ) target=1;
								display_message += "\nIs Player "+player_sit[target-1]+ " turn";
							}
							
						}
						if(target_count >= 4){
							var winner=0,win_scroce=0,scroce=0;
							on_table = [-1,-1,-1,-1];
							
							
							for(var i=0;i<4;i++){
								scroce=0; 
								target = target+1;
								if(target == 5 ) target=1;
								if( Math.floor((table_card[i]-1)/13)+1 == king_color) scroce =  ((table_card[i]-1)%13+1)*100;
								else if( Math.floor((table_card[i]-1)/13)+1 == target_color) scroce =  ((table_card[i]-1)%13+1)*10;
								else scroce=0;
								if(scroce>win_scroce){
									winner=target;
									win_scroce = scroce;
								}
							}
							teams[player_sit.indexOf(winner)%2]++;
							if( teams[player_sit.indexOf(winner)%2] == goals[player_sit.indexOf(winner)%2] ){
								if(player_sit.indexOf(winner)%2==0) display_message = "Team A Win";
								else display_message = "Team B Win";
								state = 3;
								break;
							}								
							display_message = "This round winner is Player "+player_sit[winner-1];
							target = winner;
							display_message += "\nIs Player "+player_sit[target-1]+ " turn";
							target_count = 0;
							
						}
						
						
					}
					
					break;
				default:
					break;
			}	
		});
});





































