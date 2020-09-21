async function a() {
  console.log(1);
  try {
    await b();
  } catch (error) {
    console.log('gotcha');
  }
  console.log(2);
}

async function b() {
  console.log(1);
  await Promise.reject(1);
  console.log(2);
}

a();
