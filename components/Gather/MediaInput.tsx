import { useFormik } from 'formik';

import styles from './chill.module.css';

export const MediaInput = ({ onSubmit }: { onSubmit: (p: { url: string }) => void }) => {
  const formik = useFormik({
    initialValues: {
      url: '',
    },
    onSubmit: onSubmit,
  });

  return (
    <div className={styles.modalContent}>
      <form onSubmit={formik.handleSubmit}>
        <input
          autoFocus
          className={styles.bigInput}
          placeholder="Media URL (YouTube, Soundcloud, etc)"
          id="url"
          name="url"
          onChange={formik.handleChange}
          value={formik.values.url}
        />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
};
