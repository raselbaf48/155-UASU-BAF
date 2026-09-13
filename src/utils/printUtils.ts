export const handleSafePrint = () => {
  const isIframe = (() => {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  })();

  if (isIframe) {
    alert("ব্রাউজার সিকিউরিটি পলিসির কারণে এই উইন্ডো থেকে সরাসরি প্রিন্ট করা সম্ভব নয়।\n\nদয়া করে স্ক্রিনের উপরের ডান কোণায় 'Open App' বা 'Open in new tab' বাটনে ক্লিক করে অ্যাপ্লিকেশনটি নতুন ট্যাবে ওপেন করুন এবং সেখান থেকে প্রিন্ট করুন।");
  } else {
    setTimeout(() => {
      window.print();
    }, 100);
  }
};
