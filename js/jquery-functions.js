$("document").ready(function () {
  var questionsData = [];
  var questionMap = {};
  var currentQuestionId = null;
  var questionHistory = []; // Στοίβα ιστορικού για το κουμπί "Πίσω"
  var userAnswers = {};     // Αποθήκευση επιλεγμένου optionId ανά questionId
  var faq = [];

  // Απόκρυψη κουμπιών φόρμας
  function hideFormBtns() {
    $("#nextQuestion").hide();
    $("#backButton").hide();
  }

  // Φόρτωση του νέου JSON
  function getQuestions() {
    return fetch("question-utils/questions-tree.json")
      .then((response) => response.json())
      .then((data) => {
        questionsData = data.questions;
        // Δημιουργία Map για άμεση αναζήτηση με βάση το ID της ερώτησης
        questionsData.forEach((q) => {
          questionMap[q.id] = q;
        });
        if (questionsData.length > 0) {
          currentQuestionId = questionsData[0].id;
        }
      })
      .catch((error) => {
        console.error("Σφάλμα κατά τη φόρτωση των ερωτήσεων:", error);
        $(".question-container").html(
          "<div class='govgr-error-message'>Σφάλμα: Αδυναμία φόρτωσης των ερωτήσεων.</div>"
        );
        hideFormBtns();
      });
  }

  // Φόρτωση των FAQs (αν υπάρχουν)
  function getFaq() {
    return fetch("question-utils/faq.json")
      .then((response) => response.json())
      .then((data) => {
        faq = data;
        loadFaqs();
      })
      .catch(() => {
        // Αν δεν υπάρχει αρχείο FAQ, αποκρύπτουμε το container
        $("#faqContainer").hide();
      });
  }

  function loadFaqs() {
    if (!faq || faq.length === 0) return;
    var faqElement = document.createElement("div");
    faqElement.innerHTML = `
        <div class="govgr-heading-m language-component" data-component="faq" tabIndex="15">
          Συχνές Ερωτήσεις
        </div>
    `;

    faq.forEach((faqItem) => {
      var faqSection = document.createElement("details");
      faqSection.className = "govgr-accordion__section";
      faqSection.innerHTML = `
        <summary class="govgr-accordion__section-summary">
          <h2 class="govgr-accordion__section-heading">
            <span class="govgr-accordion__section-button">
              ${faqItem.question}
            </span>
          </h2>
        </summary>
        <div class="govgr-accordion__section-content">
          <p class="govgr-body">${faqItem.answer}</p>
        </div>
      `;
      faqElement.appendChild(faqSection);
    });

    $(".faqContainer").html(faqElement).show();
  }

  // Εμφάνιση ερώτησης
  function loadQuestion(questionId, noError) {
    var question = questionMap[questionId];
    if (!question) return;

    $("#nextQuestion").show();
    if (questionHistory.length > 0) {
      $("#backButton").show();
    } else {
      $("#backButton").hide();
    }

    var savedOptionId = userAnswers[questionId];
    var questionElement = document.createElement("div");

    var optionsHtml = question.options
      .map((option) => {
        var isChecked = savedOptionId === option.id ? "checked" : "";
        return `
          <div class='govgr-radios__item'>
              <input class='govgr-radios__input' type='radio' id='opt-${option.id}' name='question-option' value='${option.id}' ${isChecked} />
              <label class='govgr-label govgr-radios__label' for='opt-${option.id}'>
                  ${option.option_text}
              </label>
          </div>
        `;
      })
      .join("");

    if (noError) {
      questionElement.innerHTML = `
        <div class='govgr-field'>
            <fieldset class='govgr-fieldset'>
                <legend role='heading' aria-level='1' class='govgr-fieldset__legend govgr-heading-l'>
                    ${question.question_text}
                </legend>
                <div class='govgr-radios' id='radios-${questionId}'>
                    ${optionsHtml}
                </div>
            </fieldset>
        </div>
      `;
    } else {
      questionElement.innerHTML = `
        <div class='govgr-field govgr-field__error'>
            <legend role='heading' aria-level='1' class='govgr-fieldset__legend govgr-heading-l'>
                ${question.question_text}
            </legend>
            <fieldset class='govgr-fieldset'>
                <p class='govgr-error-message'>
                    <span class='govgr-visually-hidden'>Λάθος:</span>
                    <span>Πρέπει να επιλέξετε μια απάντηση για να συνεχίσετε.</span>
                </p>
                <div class='govgr-radios' id='radios-${questionId}'>
                    ${optionsHtml}
                </div>
            </fieldset>
        </div>
      `;
    }

    $(".question-container").html(questionElement);
  }

  // Τερματισμός λόγω μη επιλεξιμότητας
  function showIneligible(reason) {
    hideFormBtns();
    $("#backButton").show();

    const errorEnd = document.createElement("h5");
    errorEnd.className = "govgr-error-summary";
    errorEnd.textContent =
      "Λυπούμαστε αλλά δεν δικαιούστε το δελτίο μετακίνησης ΑΜΕΑ! " + (reason || "");
    $(".question-container").html(errorEnd);
  }

  // Συλλογή όλων των απαιτούμενων δικαιολογητικών από τη διαδρομή που ακολούθησε ο χρήστης
  function collectEvidences() {
    var evidences = [];
    var seenIds = new Set();

    // Ελέγχουμε τις απαντήσεις για όλες τις ερωτήσεις του ιστορικού + την τρέχουσα
    var pathQuestionIds = [...questionHistory, currentQuestionId];

    pathQuestionIds.forEach((qId) => {
      var selectedOptId = userAnswers[qId];
      if (selectedOptId && questionMap[qId]) {
        var opt = questionMap[qId].options.find((o) => o.id === selectedOptId);
        if (opt && opt.evidences) {
          opt.evidences.forEach((ev) => {
            if (!seenIds.has(ev.id)) {
              seenIds.add(ev.id);
              evidences.push(ev.required_evidence);
            }
          });
        }
      }
    });

    return evidences;
  }

  // Επιτυχής ολοκλήρωση (Επιλέξιμος)
  function showEligible(outcomeType, reason) {
    hideFormBtns();
    $("#backButton").show(); // Επιτρέπει την επιστροφή αν επιθυμεί ο χρήστης

    // 1. Τίτλος και κείμενο δικαιώματος (όπως ήταν στο αρχικό)
    const resultWrapper = document.createElement("div");
    resultWrapper.setAttribute("id", "resultWrapper");
    resultWrapper.innerHTML = `<h1 class='answer'>Είστε δικαιούχος!</h1>`;

    // Προσθήκη του λόγου/αποτελέσματος ως <h5>
    const resultText = document.createElement("h5");
    resultText.textContent = reason;
    resultWrapper.appendChild(resultText);

    $(".question-container").html(resultWrapper);

    // 2. Συλλογή δικαιολογητικών
    var evidences = collectEvidences();

    // 3. Επικεφαλίδα δικαιολογητικών
    $(".question-container").append(
      "<br /><br /><h5 class='answer'>Τα δικαιολογητικά που πρέπει να προσκομίσετε για να λάβετε το δελτίο μετακίνησης είναι τα εξής:</h5><br />"
    );

    // 4. Αριθμημένη λίστα <ol id="evidences"> (όπως ακριβώς στο αρχικό)
    const evidenceListElement = document.createElement("ol");
    evidenceListElement.setAttribute("id", "evidences");

    evidences.forEach((evText) => {
      const listItem = document.createElement("li");
      listItem.textContent = evText;
      evidenceListElement.appendChild(listItem);
    });

    $(".question-container").append(evidenceListElement);
  }

  // Κλικ "Ας ξεκινήσουμε"
  $("#startBtn").click(function () {
    $("#intro").hide();
    $("#languageBtn").hide();
    $("#questions-btns").show();
    if (currentQuestionId) {
      loadQuestion(currentQuestionId, true);
    }
  });

  // Κλικ "Επόμενη ερώτηση"
  $("#nextQuestion").click(function () {
    var selectedRadio = $('input[name="question-option"]:checked');

    if (!selectedRadio.length) {
      loadQuestion(currentQuestionId, false);
      return;
    }

    var selectedOptionId = parseInt(selectedRadio.val(), 10);
    userAnswers[currentQuestionId] = selectedOptionId;

    var currentQuestion = questionMap[currentQuestionId];
    var selectedOption = currentQuestion.options.find(
      (o) => o.id === selectedOptionId
    );

    if (!selectedOption) return;

    // Αν η επιλογή οδηγεί σε τερματισμό
    if (selectedOption.terminate) {
      if (selectedOption.outcome_type === "ineligible") {
        showIneligible(selectedOption.termination_reason);
      } else {
        showEligible(selectedOption.outcome_type, selectedOption.termination_reason);
      }
      return;
    }

    // Μετάβαση στο επόμενο βήμα
    if (selectedOption.next_step) {
      questionHistory.push(currentQuestionId);
      currentQuestionId = selectedOption.next_step;
      loadQuestion(currentQuestionId, true);
    }
  });

  // Κλικ "Πίσω"
  $("#backButton").click(function (e) {
    e.preventDefault();
    if (questionHistory.length > 0) {
      currentQuestionId = questionHistory.pop();
      $("#questions-btns").show();
      loadQuestion(currentQuestionId, true);
    }
  });

  // Αρχικοποίηση
  $("#questions-btns").hide();
  getQuestions().then(() => {
    getFaq();
  });
});