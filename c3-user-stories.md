Please edit this template and commit to the master branch for your user stories submission.   
Make sure to follow the *Role, Goal, Benefit* framework for the user stories and the *Given/When/Then* framework for the Definitions of Done! You can also refer to the examples DoDs in [C3 spec](https://sites.google.com/view/ubc-cpsc310-21w2-intro-to-se/project/checkpoint-3).

## User Story 1 
As a student, I want to see the average of a course, so that I can see how hard a course is.


#### Definitions of Done(s)
Scenario 1: Valid pair  
Given: The bot is online  
When: The user enters a valid command with a course dept and course id pair and sends the message  
Then: Bot sends back a message with the averages of the course and their corresponding years  

Scenario 1: Invalid pair  
Given: The bot is online  
When: The user enters a valid command with a nonexistent course dept and course id pair and sends the message  
Then: Bot sends back an error message telling user to try again  



## User Story 2
As a user, I want to add a dataset, so that I can perform queries on it using the discord bot.


#### Definitions of Done(s)
Scenario 1: Adding a correctly formatted dataset  
Given: User can message the bot
When: The user input correctly formated dataset from their files using command  
Then: If added succesfully, bot will reply with a message saying the dataset has been added successfully.   

Scenario 2: Adding a incorrecrtly formatted dataset  
Given: User is on the add dataset page  
When: The user input incorrectly formated dataset from their files  using command
Then: The bot will send an error message, that the dataset was not added since there is an error with the dataset.  

## Others
You may provide any additional user stories + DoDs in this section for general TA feedback.  
Note: These will not be graded.
