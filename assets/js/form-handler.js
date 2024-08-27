document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('contact-form').addEventListener('submit', function(event) {
        event.preventDefault(); // Prevent the form from submitting in the default way

        // Retrieve user input
        const userEmail = encodeURIComponent(document.getElementById('email').value);
        const message = encodeURIComponent(document.getElementById('message').value);

        // Construct mailto link
        const mailtoLink = `mailto:mark.goertz@student.fontys.nl?subject=Message%20from%20${userEmail}&body=${message}`;

        // Redirect to mailto link
        window.location.href = mailtoLink;
    });
});