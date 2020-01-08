"use strict";
const functions = require("firebase-functions");
const { WebhookClient } = require("dialogflow-fulfillment");
//const { Card } = require("dialogflow-fulfillment");  Element is Google Assistant Specific
const BIGQUERY = require("@google-cloud/bigquery");
const BIGQUERY_CLIENT = new BIGQUERY({
projectId: "absolute-garden-257408" // Project ID
});
process.env.DEBUG = "dialogflow:debug";
exports.dialogflowFirebaseFulfillment = functions.https.onRequest(
(request, response) => {
  const agent = new WebhookClient({ request, response });
  console.log(
    "Dialogflow Request headers: " + JSON.stringify(request.headers)
  );
  console.log("Dialogflow Request body: " + JSON.stringify(request.body));

  // Default welcome function
  function welcome(agent) {
    agent.add(`Welcome to my agent!`);
  }

  // Default function when input cannot be interpreted correctly (missing intent)
  function fallback(agent) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
  }

  // Function to run upon entering ticketCollection status
  function ticketCollection(agent) {
    // Capture Parameters from the Current Dialogflow Context
    console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
    console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
    // Assignation of variables from context and request
    const OUTPUT_CONTEXTS = request.body.queryResult.outputContexts;
    const EMAIL = OUTPUT_CONTEXTS[OUTPUT_CONTEXTS.length - 1].parameters["email.original"];
    const ISSUE_CATEGORY = OUTPUT_CONTEXTS[OUTPUT_CONTEXTS.length - 1].parameters.category;
    const ISSUE_TEXT = request.body.queryResult.queryText;
 

    // The SQL Query to Run
    const SQLQUERY = `WITH pred_table AS (SELECT 5 as seniority, "3-Advanced" as experience,
          @category as category, "Request" as type)
          SELECT cast(predicted_label as INT64) as predicted_label
          FROM ML.PREDICT(MODEL helpdesk.prediccion1,  TABLE pred_table)`;

    // Options to pass on to BigQuery
    const OPTIONS = {
      query: SQLQUERY,
      // Location must match that of the dataset(s) referenced in the query.
      location: "US",
      params: {
        category: ISSUE_CATEGORY
      }
    };
    return BIGQUERY_CLIENT.query(OPTIONS)
      .then(results => {
        //Capture results from the Query
        console.log(JSON.stringify(results[0]));
        const QUERY_RESULT = results[0];
        const ETA_PREDICTION = QUERY_RESULT[0].predicted_label;
    
        //Format the Output Message
        agent.add( EMAIL + ", your ticket has been created. Someone will you contact shortly. " +
            " The estimated response time is " + ETA_PREDICTION  + " days."
        );
        
      	// Google Assistant Card code goes here. Removed for the correct implementation with Twilio
      
      	// Saving the current execution context for a lifespan of 2 (2 messages)
        agent.setContext({
          name: "submitticket-collectname-followup",
          lifespan: 2
        });
      })
      .catch(err => {
        console.error("ERROR:", err);
      });
  }

  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map();
  intentMap.set("Default Welcome Intent", welcome);
  intentMap.set("Default Fallback Intent", fallback);
  intentMap.set("Submit Ticket - Issue Category", ticketCollection);
  // Default function to execute upon receiving a message (handles the request according to previously created intentMap)
  agent.handleRequest(intentMap);
}
);