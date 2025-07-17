this.When(/^I do something$/, function (next) {
    next;
});

this.When(/^I do another thing$/, function (next) {
    next;
});

//Comments test
//this.When(/^I check one line commets doesn't affect steps$/, function (next) {next;});

/*
this.When(/^I check multi line commets doesn't affect steps$$/, function (next) {
    next;
});
*/

//Duplicates tests 
this.When(/^I do something$/, function (next) {
    next;
});

//Or test
this.When(/^I say (a|b)$/, function (next) {
    next;
});

//Multi-lines test
this.When(
    /I do some multi-lines test/,
    function(next) {
        next;
    }
);

//Outlines test
this.When(/^I test outline using "[0-9]*" variable$/, function (next) {
    next;
});

//Lower Case step definition test
this.when(/I test lower case step definition/, function(next){})

//Parameter types test
this.When(/^I biba dopa "([^"]*)" for (\d+) times for "([^"]*)" seconds$/, function (str1, int1, str2, next) {
    next;
});

//Parameter types with modern syntax
this.When('I biba dopa {string} for {int} times for {string} seconds', function (str1, int1, str2, next) {
    next;
});

//More parameter types
this.Given(/^I have a {int} in my belly$/, function (int1, next) {
    next;
});

this.Then(/^I should have {float} dollars$/, function (float1, next) {
    next;
});

//Test step for getCompletionInsertText
this.When(/^I do [a-z]+ and \w* thing$/, function (next) {
    next;
});
