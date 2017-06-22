/* Setting things up. */
var path = require('path'),
    express = require('express'),
    bodyParser = require('body-parser'),
    exphbs  = require('express-handlebars'),
    crypto = require('crypto'),
    util = require('util'),
    app = express(),   
    Twit = require('twit'),
    config = {
    /* Be sure to update the .env file with your API keys. See how to get them: https://botwiki.org/tutorials/how-to-create-a-twitter-app */      
      twitter: {
        consumer_key: process.env.CONSUMER_KEY,
        consumer_secret: process.env.CONSUMER_SECRET,
        access_token: process.env.ACCESS_TOKEN,
        access_token_secret: process.env.ACCESS_TOKEN_SECRET
      }
    },
    T = new Twit(config.twitter);
    //stream = T.stream('statuses/sample');

app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('views', __dirname + '/views');
app.set('view engine', 'handlebars');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/webhooks', function (req, res) {
/* Handle crc_token. */
  console.log('GET /webhooks');
  var res = res,
      crc_token = req.param('crc_token');

  if (crc_token){
    console.log('crc_token', crc_token);
    var response_token = 'sha256=' + crypto.createHmac('sha256', config.twitter.consumer_secret).update(crc_token).digest('base64');

    console.log('response_token', response_token);
    res.send(JSON.stringify({
      'response_token': response_token
    }));
  }
  else{
    console.log('no crc_token, registering webhook url');
    // insert the URL to the glitch app here
    T.post('account_activity/webhooks', { url: 'https://twit-webhook-bot.glitch.me/webhooks' }, function(err, data, response) {
      if (err){
        console.log('GET webhooks ERROR');
        switch(err.message){
          case 'Too many resources already created.':
            T.get('account_activity/webhooks', {}, function(err, data, response) {
              if (err){
                console.log('GET webhooks ERROR');
                console.log(err);
                // res.sendStatus(500);
              }
              else{
                if (data.valid){
                  console.log('webhook url already registered');
                  console.log(data);
                  res.sendStatus(200);                
                }
                else{
                  console.log(data);
                  console.log('deleting invalid webhook url...');

                  T.delete('account_activity/webhooks/' + data[0]['id'], {}, function(err, data, response) {
                    if (err){
                      console.log('DELETE webhooks ERROR');
                      console.log(err);
                      res.sendStatus(500);
                    }
                    else{
                      console.log('webhook url deleted');
                      /* First, de-register current URL, then redirect to register again. */
                      res.redirect('/webhooks');
                    }
                  });
                }
              }
            });
            break;
          default:
            console.log(err);
            res.sendStatus(500);
          break;
        }
      }
      else{
        console.log('webhook url registered, subscribing...');

        T.post('account_activity/webhooks/' + data.id + '/subscriptions', { webhook_id : data.id }, function(err, data, response) {
          if (err){
            console.log('GET webhooks ERROR');
            console.log(err);
            res.sendStatus(500);
          }
          else{
            console.log('webhook url registered');
            console.log(data);
            res.render('home', {'project-name': process.env.PROJECT_NAME, 'message': 'webhook url registered' });
          }
        });
      }
    });
  }
});

function get_bot_response(message){
  /* Process the message, return a response. For this example, let's just say Hi. */
  return 'Hello 👋'
}

app.post('/webhooks', function (req, res) {
  /* Handle webhook requests. */
  //console.log('New webhook request!');
  /* Uncomment the line below to see the full object that was sent to us. */
  //console.log(util.inspect(req.body, false, null));
  if (req.body.direct_message_events){
    var message = req.body.direct_message_events[0],
        users = req.body.users;
    
    switch (message.type){
       case 'message_create':
        var message_id = message.id,
            sender_id = message.message_create.sender_id,
            sender_screen_name = users[sender_id].screen_name,
            sender_name = users[sender_id].name,
            message_text = message.message_create.message_data.text,
            message_entities = message.message_create.message_data.entities;
        /*
            message_entities = { hashtags: [], symbols: [], user_mentions: [], urls: [] } 
        */
        
        if (sender_screen_name !== process.env.SCREEN_NAME){
          /* Twitter sends data about every message being sent, so we need to check if the bot is the sender. */
          //console.log(`New direct message from ${sender_name} (@${sender_screen_name}):`);
          //console.log(`> ${message_text}`);

          // uncomment to respond to messages
          // T.post('direct_messages/new', {
          //   user_id: sender_id,
          //   text: get_bot_response(message_text)
          // }, function(err, data, response) {
          //     if (err){
          //       /* TODO: Proper error handling? */
          //       console.log('Error!', err);
          //     }
          //});          
        }
        else {
          console.log('The bot sent a message.');
        }
        break;
      }   
    }
});

app.get('/', function (req, res) {
  res.render('home', {'project-name': process.env.PROJECT_NAME, 'message': null });
});

var listener = app.listen(process.env.PORT, function () {
  console.log('Your bot is running on port ' + listener.address().port);
});

/*
  TODO:
  - general cleanup
  - better error handling
  - message queue to handle API rate limits
*/